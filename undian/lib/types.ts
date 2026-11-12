export type Peserta = {
  id: string;
  nama: string;
  keterangan: string;
  createdAt: string;
};

export type Hadiah = {
  id: string;
  nama: string;
  jumlah: number;
  /** Urutan undian: angka lebih kecil = diundi lebih dulu */
  urutan: number;
  createdAt: string;
};

export type Pemenang = {
  id: string;
  hadiahId: string;
  hadiahNama: string;
  pesertaId: string;
  pesertaNama: string;
  drawnAt: string;
};

export type Pengaturan = {
  namaKegiatan: string;
};

export type StoreData = {
  pengaturan: Pengaturan;
  peserta: Peserta[];
  hadiah: Hadiah[];
  pemenang: Pemenang[];
};
