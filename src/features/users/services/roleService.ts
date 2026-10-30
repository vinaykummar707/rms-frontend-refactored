import { apiClient } from "@/integrations/api/client";
import type { Role, CreateRoleDto, UpdateRoleDto } from "@/shared/types/user";

const BASE_PATH = "/roles";

export const roleService = {
  getAll: async (_organizationId?: string): Promise<Role[]> => {
    const response = await apiClient.get(`${BASE_PATH}/active/getAllRoles`);
    return response.data?.data || response.data || [];
  },

  create: async (data: CreateRoleDto): Promise<Role> => {
    const response = await apiClient.post(`${BASE_PATH}/create`, data);
    return response.data;
  },

  update: async ({
    id,
    data,
  }: {
    id: string;
    data: UpdateRoleDto;
  }): Promise<Role> => {
    const response = await apiClient.patch(`${BASE_PATH}/updateRole/${id}`, data);
    return response.data;
  },

  delete: async (roleId: string): Promise<void> => {
    await apiClient.delete(`${BASE_PATH}/delete/${roleId}`);
  },
};

export default roleService;

