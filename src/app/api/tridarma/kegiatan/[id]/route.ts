import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailKegiatan } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(id, (itemId, session) => detailKegiatan(itemId, session), "kegiatan");
}
