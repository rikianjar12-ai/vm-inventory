#!/usr/bin/env bash
# Ekspor daftar service yang dipantau + status aktif saat ini.
# - lrt_service_expected{name="x"} 1  = service ini wajib pantau (sticky)
# - lrt_service_up{name="x"} 1/0      = apakah saat ini aktif (dicek sebagai root)
#
# Alert memakai expected==1 AND up==0, tanpa bergantung pada collector systemd
# node_exporter (yang sering gagal karena user nodeexp).
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

TEXTDIR="${TEXTFILE_DIR:-/var/lib/node_exporter/textfile}"
STATE_DIR="${STATE_DIR:-/var/lib/lrt-monitoring}"
STATE_FILE="${STATE_DIR}/expected-services.list"
TMP_ACTIVE="$(mktemp)"
TMP_MERGED="$(mktemp)"
TMP_PROM="$(mktemp)"
trap 'rm -f "$TMP_ACTIVE" "$TMP_MERGED" "$TMP_PROM"' EXIT

mkdir -p "$TEXTDIR" "$STATE_DIR"

is_watchable() {
  local unit="$1"
  local stype
  case "$unit" in
    *.timer|*.mount|*.scope|*.slice|*.path|*.socket|*.target) return 1 ;;
    aide*.service|aidecheck*.service) return 1 ;;
    systemd-*.service|user@*.service|getty@*.service|serial-getty@*.service) return 1 ;;
    plymouth*.service|kmod-*.service|dracut-*.service|man-db.service|logrotate.service) return 1 ;;
    run-r*.service|*-fixup.service|*-update-*.service) return 1 ;;
    # noise OS umum — biasanya bukan service aplikasi
    NetworkManager*.service|ModemManager.service|chronyd.service|auditd.service) return 1 ;;
    irqbalance.service|tuned.service|smartd.service|sysstat.service) return 1 ;;
    lvm2-*.service|dm-event.service|blk-availability.service) return 1 ;;
    multipathd.service|gssproxy.service|rpcbind.service|rpc-*.service) return 1 ;;
    postfix.service|crond.service|cron.service|atd.service|rsyslog.service|syslog.service) return 1 ;;
    sshd.service|ssh.service) return 1 ;;
    node_exporter.service|process_exporter.service|promtail.service|lrt-export-services.service) return 1 ;;
    # agen keamanan / inventory host — bukan service aplikasi bisnis
    cbagentd.service|cbdaemon.service|falcon-sensor.service) return 1 ;;
    wazuh-agent.service|zabbix-agent*.service|telegraf.service) return 1 ;;
  esac
  stype="$(systemctl show -p Type --value "$unit" 2>/dev/null || true)"
  case "$stype" in
    oneshot|idle|dbus) return 1 ;;
  esac
  return 0
}

unit_is_active() {
  local unit="$1"
  local state
  state="$(systemctl is-active "$unit" 2>/dev/null || true)"
  [[ "$state" == "active" ]]
}

: > "$TMP_ACTIVE"
while IFS= read -r unit; do
  [[ -z "$unit" ]] && continue
  is_watchable "$unit" || continue
  printf '%s\n' "$unit" >> "$TMP_ACTIVE"
done < <(systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{print $1}')

touch "$STATE_FILE"
cat "$STATE_FILE" "$TMP_ACTIVE" | sed '/^$/d' | sort -u > "$TMP_MERGED"
cp "$TMP_MERGED" "$STATE_FILE"

{
  echo "# HELP lrt_service_expected Service yang dipantau agar tetap aktif di server ini."
  echo "# TYPE lrt_service_expected gauge"
  echo "# HELP lrt_service_up 1 jika service expected sedang aktif, 0 jika tidak."
  echo "# TYPE lrt_service_up gauge"
  while IFS= read -r unit; do
    [[ -z "$unit" ]] && continue
    safe="$(printf '%s' "$unit" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    echo "lrt_service_expected{name=\"${safe}\"} 1"
    if unit_is_active "$unit"; then
      echo "lrt_service_up{name=\"${safe}\"} 1"
    else
      echo "lrt_service_up{name=\"${safe}\"} 0"
    fi
  done < "$STATE_FILE"
} > "$TMP_PROM"

mv "$TMP_PROM" "$TEXTDIR/lrt_service_expected.prom"
chmod 0644 "$TEXTDIR/lrt_service_expected.prom"

count="$(grep -c . "$STATE_FILE" || true)"
down="$(grep -c 'lrt_service_up{.*} 0$' "$TEXTDIR/lrt_service_expected.prom" || true)"
echo "OK: ${count} service dipantau, ${down} sedang tidak aktif → ${TEXTDIR}/lrt_service_expected.prom"
