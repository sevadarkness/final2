/**
 * Pagination Utilities
 * Helpers for handling pagination in API responses
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

/**
 * Parse pagination parameters from request
 */
export function parsePagination(query) {
  const page = parseInt(query.page) || DEFAULT_PAGE;
  const perPage = Math.min(
    parseInt(query.perPage) || parseInt(query.per_page) || DEFAULT_PER_PAGE,
    MAX_PER_PAGE
  );
  
  // Ensure valid values
  const validPage = Math.max(1, page);
  const validPerPage = Math.max(1, Math.min(perPage, MAX_PER_PAGE));
  
  // Calculate skip for database query
  const skip = (validPage - 1) * validPerPage;
  
  return {
    page: validPage,
    perPage: validPerPage,
    skip,
    take: validPerPage,
  };
}

/**
 * Format paginated response
 */
export function formatPaginatedResponse(data, total, pagination) {
  const { page, perPage } = pagination;
  const totalPages = Math.ceil(total / perPage);
  
  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    },
  };
}

/**
 * Create pagination metadata only
 */
export function createPaginationMeta(total, pagination) {
  const { page, perPage } = pagination;
  const totalPages = Math.ceil(total / perPage);
  
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
}

/**
 * Parse sorting parameters
 */
export function parseSorting(query, allowedFields = [], defaultField = 'createdAt', defaultOrder = 'desc') {
  const sortBy = query.sortBy || query.sort_by || defaultField;
  const order = (query.order || query.sort_order || defaultOrder).toLowerCase();
  
  // Validate sort field
  const validSortBy = allowedFields.length > 0 && !allowedFields.includes(sortBy)
    ? defaultField
    : sortBy;
  
  // Validate order
  const validOrder = ['asc', 'desc'].includes(order) ? order : defaultOrder;
  
  return {
    sortBy: validSortBy,
    order: validOrder,
    orderBy: {
      [validSortBy]: validOrder,
    },
  };
}

/**
 * Parse filter parameters
 */
export function parseFilters(query, allowedFilters = []) {
  const filters = {};
  
  for (const filter of allowedFilters) {
    if (query[filter] !== undefined && query[filter] !== '') {
      filters[filter] = query[filter];
    }
  }
  
  return filters;
}

/**
 * Create Prisma pagination object
 */
export function toPrismaPagination(pagination) {
  return {
    skip: pagination.skip,
    take: pagination.take,
  };
}

/**
 * Create cursor-based pagination parameters
 */
export function parseCursorPagination(query) {
  const perPage = Math.min(
    parseInt(query.perPage) || parseInt(query.per_page) || DEFAULT_PER_PAGE,
    MAX_PER_PAGE
  );
  
  const cursor = query.cursor || query.after;
  
  return {
    take: perPage,
    ...(cursor && {
      skip: 1, // Skip the cursor itself
      cursor: {
        id: cursor,
      },
    }),
  };
}

/**
 * Format cursor-based paginated response
 */
export function formatCursorPaginatedResponse(data, perPage) {
  const hasMore = data.length > perPage;
  const items = hasMore ? data.slice(0, -1) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;
  
  return {
    data: items,
    pagination: {
      hasMore,
      nextCursor,
      perPage,
    },
  };
}

/**
 * Calculate offset and limit from page
 */
export function calculateOffset(page, perPage) {
  const validPage = Math.max(1, parseInt(page) || DEFAULT_PAGE);
  const validPerPage = Math.min(
    Math.max(1, parseInt(perPage) || DEFAULT_PER_PAGE),
    MAX_PER_PAGE
  );
  
  return {
    offset: (validPage - 1) * validPerPage,
    limit: validPerPage,
  };
}

/**
 * Parse search query
 */
export function parseSearch(query) {
  const search = query.search || query.q || '';
  return search.trim();
}

/**
 * Create search filter for Prisma
 */
export function createSearchFilter(searchTerm, fields = []) {
  if (!searchTerm || fields.length === 0) return {};
  
  return {
    OR: fields.map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    })),
  };
}

export default {
  parsePagination,
  formatPaginatedResponse,
  createPaginationMeta,
  parseSorting,
  parseFilters,
  toPrismaPagination,
  parseCursorPagination,
  formatCursorPaginatedResponse,
  calculateOffset,
  parseSearch,
  createSearchFilter,
};
