/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import slugify from "slugify";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { ICreateCategoryPayload, IUpdateCategoryPayload } from "./category.interface";

const getAllCategories = async (query: Record<string, any>) => {
    // If tree view is requested (e.g. for storefront MegaMenu or nested category picker)
    if (query.tree === "true") {
        const categoriesTree = await prisma.category.findMany({
            where: {
                parentId: null,
                ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
            },
            orderBy: { sortOrder: "asc" },
            include: {
                children: {
                    where: {
                        ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
                    },
                    orderBy: { sortOrder: "asc" },
                    include: {
                        children: {
                            where: {
                                ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
                            },
                            orderBy: { sortOrder: "asc" },
                        },
                    },
                },
            },
        });

        return {
            data: categoriesTree,
            meta: {
                total: categoriesTree.length,
                page: 1,
                limit: categoriesTree.length,
                totalPages: 1,
            },
        };
    }

    // Standard paginated & searchable flat list using QueryBuilder
    const queryBuilder = new QueryBuilder(prisma.category, query, {
        searchableFields: ["name", "nameBn", "slug"],
        filterableFields: ["isActive", "parentId"],
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            parent: {
                select: { id: true, name: true, slug: true },
            },
            _count: {
                select: { products: true, children: true },
            },
        });

    return await queryBuilder.execute();
};

const getCategoryByIdOrSlug = async (idOrSlug: string) => {
    const category = await prisma.category.findFirst({
        where: {
            OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        },
        include: {
            parent: true,
            children: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
            },
            _count: {
                select: { products: true },
            },
        },
    });

    if (!category) {
        throw new AppError(status.NOT_FOUND, "Category not found");
    }

    return category;
};

const createCategory = async (payload: ICreateCategoryPayload, file?: Express.Multer.File) => {
    const generatedSlug = payload.slug || slugify(payload.name, { lower: true, strict: true });

    // Check for unique name or slug
    const existing = await prisma.category.findFirst({
        where: {
            OR: [{ name: payload.name }, { slug: generatedSlug }],
        },
    });

    if (existing) {
        throw new AppError(status.CONFLICT, "Category with this name or slug already exists");
    }

    // Verify parentId if provided
    if (payload.parentId) {
        const parentCategory = await prisma.category.findUnique({
            where: { id: payload.parentId },
        });

        if (!parentCategory) {
            throw new AppError(status.NOT_FOUND, "Parent category not found");
        }
    }

    const imageUrl = file?.path || payload.image;

    const newCategory = await prisma.category.create({
        data: {
            name: payload.name,
            nameBn: payload.nameBn,
            slug: generatedSlug,
            description: payload.description,
            icon: payload.icon,
            image: imageUrl,
            sortOrder: payload.sortOrder || 0,
            isActive: payload.isActive !== undefined ? payload.isActive : true,
            parentId: payload.parentId || null,
        },
        include: {
            parent: true,
        },
    });

    return newCategory;
};

const updateCategory = async (
    id: string,
    payload: IUpdateCategoryPayload,
    file?: Express.Multer.File
) => {
    const existing = await prisma.category.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Category not found");
    }

    // Prevent category from being its own parent
    if (payload.parentId && payload.parentId === id) {
        throw new AppError(status.BAD_REQUEST, "A category cannot be its own parent");
    }

    // Verify parentId if changed
    if (payload.parentId) {
        const parentCategory = await prisma.category.findUnique({
            where: { id: payload.parentId },
        });

        if (!parentCategory) {
            throw new AppError(status.NOT_FOUND, "Parent category not found");
        }
    }

    const newSlug = payload.name && !payload.slug
        ? slugify(payload.name, { lower: true, strict: true })
        : payload.slug;

    // Check unique conflict on name or slug if updated
    if (payload.name || newSlug) {
        const conflict = await prisma.category.findFirst({
            where: {
                id: { not: id },
                OR: [
                    ...(payload.name ? [{ name: payload.name }] : []),
                    ...(newSlug ? [{ slug: newSlug }] : []),
                ],
            },
        });

        if (conflict) {
            throw new AppError(status.CONFLICT, "Another category with this name or slug already exists");
        }
    }

    const imageUrl = file?.path || payload.image;

    const updated = await prisma.category.update({
        where: { id },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(payload.nameBn !== undefined && { nameBn: payload.nameBn }),
            ...(newSlug && { slug: newSlug }),
            ...(payload.description !== undefined && { description: payload.description }),
            ...(payload.icon !== undefined && { icon: payload.icon }),
            ...(imageUrl && { image: imageUrl }),
            ...(payload.sortOrder !== undefined && { sortOrder: payload.sortOrder }),
            ...(payload.isActive !== undefined && { isActive: payload.isActive }),
            ...(payload.parentId !== undefined && { parentId: payload.parentId || null }),
        },
        include: {
            parent: true,
            children: true,
        },
    });

    return updated;
};

const deleteCategory = async (id: string) => {
    const category = await prisma.category.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    children: true,
                    products: true,
                },
            },
        },
    });

    if (!category) {
        throw new AppError(status.NOT_FOUND, "Category not found");
    }

    if (category._count.children > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot delete category. It has ${category._count.children} sub-categories attached. Please delete or re-assign them first.`
        );
    }

    if (category._count.products > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot delete category. It has ${category._count.products} products attached. Please re-assign products first.`
        );
    }

    await prisma.category.delete({
        where: { id },
    });

    return { message: "Category deleted successfully" };
};

export const CategoryService = {
    getAllCategories,
    getCategoryByIdOrSlug,
    createCategory,
    updateCategory,
    deleteCategory,
};

