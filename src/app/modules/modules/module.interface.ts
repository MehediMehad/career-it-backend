export interface IModuleFilterRequest {
  searchTerm?: string;
  courseId?: string;
  milestoneId?: string;
}

export interface ICreateModule {
  moduleNumber: number;
  title: string;
  courseId: string;
  milestoneId: string;
}

export interface IUpdateModule {
  moduleNumber?: number;
  title?: string;
  courseId?: string;
  milestoneId?: string;
}

export interface IReorderModuleItem {
  id: string;
  moduleNumber: number;
}

export interface IReorderModulesPayload {
  courseId: string;
  milestoneId: string;
  items: IReorderModuleItem[];
}
