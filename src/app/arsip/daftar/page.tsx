import DaftarArsipPage from "@/components/Arsip/DaftarArsip/Daftararsip";

export default function Page(props: PageProps<"/arsip/daftar">) {
  return <DaftarArsipPage searchParams={props.searchParams} />;
}
