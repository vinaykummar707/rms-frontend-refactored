import { createCrudHooks } from "@/shared/hooks/useCrud";
import type { IStop, IStopCreate, IStopUpdate } from "@/shared/types/stop";

export const stopCrud = createCrudHooks<IStop, IStopCreate, IStopUpdate>("stops");

