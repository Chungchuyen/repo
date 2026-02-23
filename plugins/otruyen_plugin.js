// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "otruyen",
        "name": "OTruyen",
        "version": "1.0.0",
        "baseUrl": "https://otruyenapi.com",
        "iconUrl": "https://otruyenapi.com/favicon.ico",
        "isEnabled": true,
        "type": "MANGA"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'truyen-moi', title: 'Truyện Mới Cập Nhật', type: 'Grid', path: 'danh-sach' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: [
            { name: 'Mới cập nhật', value: 'update' },
            { name: 'Lượt xem', value: 'view' }
        ]
    });
}

// =============================================================================
// URL GENERATION
// =============================================================================

function getUrlList(slug, filtersJson) {
    try {
        var filters = JSON.parse(filtersJson || "{}");
        var page = filters.page || 1;
        var baseUrl = "https://otruyenapi.com/v1/api";

        // Default: danh-sach/truyen-moi
        var finalPath = "/danh-sach/truyen-moi";

        // Nếu có category filter
        if (filters.category) {
            finalPath = "/the-loai/" + filters.category;
        } else if (slug && slug !== 'truyen-moi') {
            // Nếu slug khác truyen-moi, dùng làm thể loại
            finalPath = "/the-loai/" + slug;
        }

        var url = baseUrl + finalPath + "?page=" + page;

        return url;
    } catch (e) {
        return "https://otruyenapi.com/v1/api/danh-sach/truyen-moi?page=1";
    }
}

function getUrlSearch(keyword, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    return "https://otruyenapi.com/v1/api/tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
}

function getUrlDetail(slug) {
    return "https://otruyenapi.com/v1/api/truyen-tranh/" + slug;
}

function getUrlCategories() {
    return "https://otruyenapi.com/v1/api/the-loai";
}

function getUrlCountries() {
    return ""; // OTruyen không có API quốc gia
}

function getUrlYears() {
    return ""; // OTruyen không có API năm
}

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var data = response.data || {};
        var items = data.items || [];
        var pagination = data.params?.pagination || {};

        var mangas = items.map(function (item) {
            return {
                id: item.slug,
                title: item.name,
                posterUrl: getImageUrl(item.thumb_url),
                backdropUrl: getImageUrl(item.thumb_url),
                status: item.status || ""
            };
        });

        return JSON.stringify({
            items: mangas,
            pagination: {
                currentPage: pagination.currentPage || 1,
                totalPages: Math.ceil((pagination.totalItems || 0) / (pagination.totalItemsPerPage || 24)),
                totalItems: pagination.totalItems || 0,
                itemsPerPage: pagination.totalItemsPerPage || 24
            }
        });
    } catch (error) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(apiResponseJson) {
    return parseListResponse(apiResponseJson);
}

function parseMovieDetail(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var item = response.data?.item || {};
        var chapters = item.chapters || [];

        // Chuyển đổi chapters thành servers format
        var servers = [];

        chapters.forEach(function (chapterGroup) {
            var episodes = [];
            if (chapterGroup.server_data) {
                chapterGroup.server_data.forEach(function (chapter) {
                    episodes.push({
                        id: chapter.chapter_api_data,
                        name: chapter.chapter_name,
                        slug: chapter.chapter_api_data
                    });
                });
            }

            if (episodes.length > 0) {
                servers.push({
                    name: chapterGroup.server_name || "Server 1",
                    episodes: episodes
                });
            }
        });

        // Extract metadata
        var categories = (item.category || []).map(function (c) {
            return c.name || c;
        }).join(", ");

        return JSON.stringify({
            id: item.slug,
            title: item.name,
            posterUrl: getImageUrl(item.thumb_url),
            backdropUrl: getImageUrl(item.thumb_url),
            description: (item.content || "").replace(/<[^>]*>/g, ""),
            status: item.status || "",
            servers: servers,
            category: categories,
            author: (item.author || []).join(", ")
        });
    } catch (error) {
        return "null";
    }
}

function parseDetailResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var item = response.data?.item || {};
        var cdnDomain = response.data?.domain_cdn || "https://img.otruyenapi.com";

        // Parse chapter images
        var images = [];
        if (item.chapter_image) {
            item.chapter_image.forEach(function (img) {
                var imagePath = item.chapter_path || "";
                var fullUrl = cdnDomain + "/" + imagePath + "/" + img.image_file;
                images.push(fullUrl);
            });
        }

        return JSON.stringify({
            images: images,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://otruyen.cc"
            }
        });
    } catch (error) {
        return "{}";
    }
}

function parseCategoriesResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var items = response.data?.items || [];
        return JSON.stringify(items.map(function (i) {
            return { name: i.name, slug: i.slug };
        }));
    } catch (e) {
        return "[]";
    }
}

function parseCountriesResponse(apiResponseJson) {
    return "[]"; // OTruyen không có quốc gia
}

function parseYearsResponse(apiResponseJson) {
    return "[]"; // OTruyen không có năm
}

function getImageUrl(path) {
    if (!path) return "";
    if (path.indexOf("http") === 0) return path;
    return "https://img.otruyenapi.com/uploads/comics/" + path;
}
