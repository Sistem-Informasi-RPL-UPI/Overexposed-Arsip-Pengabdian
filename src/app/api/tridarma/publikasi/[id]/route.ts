import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailPublikasi } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(id, (itemId, session) => detailPublikasi(itemId, session), "publikasi");
}
