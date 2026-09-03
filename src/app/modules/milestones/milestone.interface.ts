export interface IMilestoneFilterRequest {
  searchTerm?: string;
  courseId?: string;
}

export interface ICreateMilestone {
  title: string;
  subtitle: string;
  courseId: string;
}

export interface IUpdateMilestone {
  title?: string;
  subtitle?: string;
  courseId?: string;
}
