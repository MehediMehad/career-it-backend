export interface ICategoryFilterRequest {
  searchTerm?: string;
  isDeleted?: string | boolean;
}

export interface ICreateCategory {
  title: string;
  image?: string;
}

export interface IUpdateCategory {
  title?: string;
  image?: string;
  isDeleted?: boolean;
}
