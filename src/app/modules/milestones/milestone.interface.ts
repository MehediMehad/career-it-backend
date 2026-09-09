export interface IMilestoneFilterRequest {
  searchTerm?: string;
  courseId?: string;
}

export interface ICreateMilestone {
  milestoneNumber: number;
  title: string;
  subtitle: string;
  courseId: string;
}

export interface IUpdateMilestone {
  milestoneNumber: number;
  title?: string;
  subtitle?: string;
  courseId?: string;
}

export interface IReorderMilestoneItem {
  id: string;
  milestoneNumber: number;
}

export interface IReorderMilestonesPayload {
  courseId: string;
  items: IReorderMilestoneItem[];
}
