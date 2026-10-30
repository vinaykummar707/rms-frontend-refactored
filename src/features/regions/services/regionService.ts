import { checkActiveDuplicate } from "@/shared/hooks/useCrud";
import {
  confirmRegionDelete,
  getRegionDeleteImpactMessage,
} from "@/shared/utils/deleteImpact";

export async function checkRegionNameDuplicate(
  name: string,
  organizationId: string,
  excludeId?: string
): Promise<boolean> {
  return checkActiveDuplicate(
    "regions",
    "name",
    name,
    { organization_id: organizationId },
    excludeId
  );
}

export { confirmRegionDelete, getRegionDeleteImpactMessage };

