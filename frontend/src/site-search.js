const baseUrl = import.meta.env.BASE_URL;
const searchPages = [
  { path: baseUrl, label: 'Home' },
  { path: `${baseUrl}about.html`, label: 'About Us' },
  { path: `${baseUrl}campuses.html`, label: 'Campuses' },
  { path: `${baseUrl}administration.html`, label: 'Administration' },
  { path: `${baseUrl}academic.html`, label: 'Academic' },
  { path: `${baseUrl}registration.html`, label: 'Registration' }
];

async function fetchPageIndex(page) {
  try {
    const response = await fetch(page.path);
    if (!response.ok) return [];
    const html = await response.text();
    const parsedPage = new DOMParser().parseFromString(html, 'text/html');
    const content = parsedPage.querySelector('main');
    if (!content) return [];

    return [...content.querySelectorAll('h1, h2, h3, p, li')]
      .map((element) => {
        const text = element.textContent.replace(/\s+/g, ' ').trim();
        if (text.length < 3) return null;
        const section = element.closest('section[id], article[id]');
        const sectionHeading = section?.querySelector('h1, h2, h3')?.textContent.trim();
        const heading = element.matches('h1, h2, h3') ? text : sectionHeading || page.label;
        const snippet = text.length > 170 ? `${text.slice(0, 167)}...` : text;
        const hash = section?.id ? `#${encodeURIComponent(section.id)}` : '';

        return {
          page: page.label,
          heading,
          snippet,
          text: `${page.label} ${heading} ${text}`.toLocaleLowerCase(),
          href: `${page.path}${hash}`
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

let searchIndexPromise;
function getSearchIndex() {
  searchIndexPromise ||= Promise.all(searchPages.map(fetchPageIndex)).then((pages) => pages.flat());
  return searchIndexPromise;
}

function renderResults(container, results, query) {
  container.replaceChildren();
  if (!results.length) {
    container.textContent = `No pages found for "${query}".`;
    return;
  }

  const summary = document.createElement('p');
  summary.className = 'site-search-summary';
  summary.textContent = `${results.length} matching section${results.length === 1 ? '' : 's'}`;
  container.append(summary);

  for (const result of results.slice(0, 8)) {
    const item = document.createElement('article');
    item.className = 'site-search-result';
    const link = document.createElement('a');
    link.href = result.href;
    link.textContent = `${result.page}: ${result.heading}`;
    const excerpt = document.createElement('p');
    excerpt.textContent = result.snippet;
    item.append(link, excerpt);
    container.append(item);
  }
}

for (const search of document.querySelectorAll('.brand-search')) {
  const form = search.querySelector('.site-search-form');
  const input = search.querySelector('.site-search-input');
  const resultsContainer = search.querySelector('.site-search-results');

  search.addEventListener('toggle', () => {
    if (search.open) input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    resultsContainer.textContent = 'Searching...';
    const terms = query.toLocaleLowerCase().split(/\s+/);
    const index = await getSearchIndex();
    const results = index.filter((entry) => terms.every((term) => entry.text.includes(term)));
    renderResults(resultsContainer, results, query);
  });
}
