// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "bunchatv",
        "name": "BunCha TV",
        "version": "1.0.0",
        "baseUrl": "https://bunchatv.net",
        "iconUrl": "https://bunchatv.net/favicon.ico",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'truc-tiep-bong-da-xoilac-tv', title: '🔴 Trực Tiếp Bóng Đá', type: 'Grid', path: '' },
        { slug: 'ket-qua-bong-da', title: '✅ Kết Quả Hôm Nay', type: 'Horizontal', path: '' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Trực Tiếp', slug: 'truc-tiep-bong-da-xoilac-tv' },
        { name: 'Kết Quả', slug: 'ket-qua-bong-da' },
        { name: 'Lịch Thi Đấu', slug: 'lich-thi-dau-bong-da' },
        { name: 'Bảng Xếp Hạng', slug: 'bang-xep-hang-bong-da' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: [
            { name: 'Mặc định', value: 'default' }
        ],
        category: [
            { name: 'Tất cả', value: '' },
            { name: 'BLV BunCha', value: 'buncha' }
        ]
    });
}

// =============================================================================
// URL GENERATION
// =============================================================================

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var baseUrl = "https://bunchatv.net";

    if (!slug) slug = "truc-tiep-bong-da-xoilac-tv";

    // bunchatv usually doesn't use standard pagination for live list, but let's handle it
    return baseUrl + "/" + slug;
}

function getUrlSearch(keyword, filtersJson) {
    return "https://bunchatv.net/?s=" + encodeURIComponent(keyword);
}

function getUrlDetail(slug) {
    if (!slug) return "";
    if (slug.indexOf("http") === 0) return slug;
    // Ensure no double slash when joining
    var cleanSlug = slug.replace(/^\//, "");
    return "https://bunchatv.net/" + cleanSlug;
}

function getUrlCategories() { return "https://bunchatv.net/"; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// UTILS
// =============================================================================

var PluginUtils = {
    cleanText: function (text) {
        if (!text) return "";
        return text.replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();
    }
};

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(html) {
    var matches = [];
    var foundIds = {};

    // Match grid-match blocks
    var itemRegex = /<div[^>]*class="[^"]*grid-match[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    var match;

    while ((match = itemRegex.exec(html)) !== null) {
        var itemHtml = match[1];

        // Teams
        var teams = [];
        var teamNameRegex = /<div[^>]*class="[^"]*grid-match__team-name[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        var tm;
        while ((tm = teamNameRegex.exec(itemHtml)) !== null) {
            teams.push(PluginUtils.cleanText(tm[1]));
        }
        var title = teams.length >= 2 ? teams[0] + " vs " + teams[1] : "Tường thuật bóng đá";

        // Link
        var linkMatch = itemHtml.match(/href="([^"]*truc-tiep\/[^"]+)"/i) ||
            itemHtml.match(/href="([^"]*ket-qua\/[^"]+)"/i);
        if (!linkMatch) continue;
        var fullUrl = linkMatch[1];
        var id = fullUrl.replace("https://bunchatv.net/", "")
            .replace(/^\//, "")
            .replace(/\/$/, "");

        // Thumbnail (Logo 1)
        var thumbMatch = itemHtml.match(/<img[^>]*class="[^"]*grid-match__team-logo[^"]*"[^>]*src="([^"]+)"/i) ||
            itemHtml.match(/<img[^>]*src="([^"]+)"/i);
        var thumb = thumbMatch ? thumbMatch[1] : "";

        // Status/Commentator
        var statusMatch = itemHtml.match(/<div[^>]*class="[^"]*grid-match__time[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
            itemHtml.match(/<span[^>]*class="[^"]*live[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        var status = statusMatch ? PluginUtils.cleanText(statusMatch[1]) : "Sắp tới";

        var commentatorMatch = itemHtml.match(/<div[^>]*class="[^"]*grid-match__commentator-name[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        var commentator = commentatorMatch ? PluginUtils.cleanText(commentatorMatch[1]) : "";
        if (commentator) status = commentator + " - " + status;

        if (id && !foundIds[id]) {
            matches.push({
                id: id,
                title: title,
                posterUrl: thumb,
                backdropUrl: thumb,
                description: "",
                quality: "Live",
                episode_current: status,
                lang: "Tiếng Việt"
            });
            foundIds[id] = true;
        }
    }

    return JSON.stringify({
        items: matches,
        pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: matches.length,
            itemsPerPage: 100
        }
    });
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        // Title
        var titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
            html.match(/<title>([\s\S]*?)<\/title>/i);
        var title = titleMatch ? PluginUtils.cleanText(titleMatch[1]) : "Trực tiếp bóng đá";

        // Description
        var description = "";
        var descMatch = html.match(/<div[^>]*id="[^"]*match-detail-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) description = PluginUtils.cleanText(descMatch[1]);

        // Servers (Commentators / Channels)
        var servers = [];
        var channels = [];

        // 1. Precise extraction from div.watch_userItem__nwzZM
        var itemRegex = /<div[^>]*class="[^"]*watch_userItem[^"]*"[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
        var itemMatch;
        while ((itemMatch = itemRegex.exec(html)) !== null) {
            var dataUrl = itemMatch[1];
            var innerHtml = itemMatch[2];

            // Name is usually in a span or text
            var nameMatch = innerHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/i) ||
                innerHtml.match(/>\s*([^<]+)\s*</);
            var name = nameMatch ? PluginUtils.cleanText(nameMatch[1]) : "Kênh Phụ";

            // Extract urlHls from data-url
            var hlsMatch = dataUrl.match(/urlHls=([^"&]+)/i);
            var streamLink = hlsMatch ? decodeURIComponent(hlsMatch[1]) : dataUrl;

            channels.push({
                id: streamLink,
                name: name,
                slug: name
            });
        }

        // 2. Fallback to general BLV spans if div.watch_userItem failed
        if (channels.length === 0) {
            var blvRegex = /<span[^>]*>\s*(BLV [^<]+|Sóng [^<]+|K\+ [^<]+)\s*<\/span>/gi;
            var bm;
            while ((bm = blvRegex.exec(html)) !== null) {
                var blvName = PluginUtils.cleanText(bm[1]);
                channels.push({
                    id: "default",
                    name: blvName,
                    slug: blvName
                });
            }
        }

        // 3. Final default
        if (channels.length === 0) {
            channels.push({ id: "default", name: "Trực Tiếp BunCha", slug: "live" });
        }

        servers.push({
            name: "Server BunCha",
            episodes: channels
        });

        return JSON.stringify({
            id: "",
            title: title,
            posterUrl: "",
            backdropUrl: "",
            description: description,
            servers: servers,
            quality: "HD",
            lang: "Tiếng Việt",
            status: "Đang diễn ra"
        });
    } catch (e) {
        return "null";
    }
}

function parseDetailResponse(html) {
    try {
        var streamUrl = "";

        // If html is already a URL (passed as ID from parseMovieDetail)
        if (html && (html.indexOf("http") === 0 || html.indexOf(".m3u8") !== -1)) {
            streamUrl = html;
        }

        // Fallback: search in HTML
        if (!streamUrl) {
            var iframeMatch = html.match(/<iframe[^>]+src="[^"]*urlHls=([^"&]+)/i);
            if (iframeMatch) {
                streamUrl = decodeURIComponent(iframeMatch[1]);
            }
        }

        if (!streamUrl) {
            var m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
            if (m3u8Match) {
                streamUrl = m3u8Match[1];
            }
        }

        if (streamUrl) {
            return JSON.stringify({
                url: streamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://bunchatv.net/",
                    "Origin": "https://bunchatv.net"
                },
                subtitles: []
            });
        }

        return "{}";
    } catch (e) {
        return "{}";
    }
}

function parseCategoriesResponse(html) {
    return getPrimaryCategories();
}

function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }
