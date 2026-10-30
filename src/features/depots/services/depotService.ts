import { checkActiveDuplicate } from "@/shared/hooks/useCrud";
import {
  confirmDepotDelete,
  getDepotDeleteImpactMessage,
} from "@/shared/utils/deleteImpact";

export async function checkDepotNameDuplicate(
  name: string,
  regionId: string,
  excludeId?: string
): Promise<boolean> {
  return checkActiveDuplicate(
    "depots",
    "name",
    name,
    { region_id: regionId },
    excludeId
  );
}

export { confirmDepotDelete, getDepotDeleteImpactMessage };

