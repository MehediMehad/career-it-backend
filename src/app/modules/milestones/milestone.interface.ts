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
