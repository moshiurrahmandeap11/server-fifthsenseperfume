export interface ICreateCategoryPayload {
    name: string;
    nameBn?: string;
    slug?: string;
    description?: string;
    icon?: string;
    image?: string;
    sortOrder?: number;
    isActive?: boolean;
    parentId?: string | null;
}

export interface IUpdateCategoryPayload {
    name?: string;
    nameBn?: string;
    slug?: string;
    description?: string;
    icon?: string;
    image?: string;
    sortOrder?: number;
    isActive?: boolean;
    parentId?: string | null;
}

