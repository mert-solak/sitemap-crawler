/* eslint-disable no-useless-escape */
import * as fs from 'fs';
import * as path from 'path';

import { CategorisedSitemap, Category } from './sitemap.type';
import {
  mainSitemapPostfix,
  mainSitemapPrefix,
  mainXmlFile,
  sitemapPostfix,
  sitemapPrefix,
} from './sitemap.local';

const onlyUnique = (value: string, index: number, array: string[]) => array.indexOf(value) === index;

const parseHtml = (htmlDocument: string, baseURL: string): string[] => {
  const allLinks = htmlDocument.match(/(?<=href=")[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\/\:]+(?=")/g);

  return (
    allLinks
      ?.filter((link) => {
        if (link.startsWith(baseURL)) {
          return true;
        }
        if (link.startsWith('//')) {
          return false;
        }
        if (link.startsWith('/')) {
          return true;
        }

        return false;
      })
      .map((link) => link.replace(baseURL, '')) ?? []
  );
};

const addToSiteMap = async (
  htmlDocument: string,
  response: Response,
  sitemap: string,
  fullPath: string,
  dateCallback?: (urlParam: string) => Promise<string>,
): Promise<string> => {
  if (htmlDocument.includes('content="noindex,nofollow"') || !response.status.toString().startsWith('2')) {
    return sitemap;
  }

  let newSitemap = sitemap;

  try {
    let date;
    if (dateCallback) {
      date = await dateCallback(fullPath);
    } else {
      date = new Date()
        .toLocaleDateString('tr-TR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace('/', '-');
    }

    newSitemap += `\n<url>
    <loc>${fullPath}</loc>
    <lastmod>${date}</lastmod>
</url>`;

    return newSitemap;
  } catch (error) {
    return sitemap;
  }
};

const visitLink = async (
  url: string,
  baseURL: string,
  links: string[],
  urlsVisited: string[],
  sitemap: string,
  categories?: Category[],
  dateCallback?: (urlParam: string) => Promise<string>,
): Promise<CategorisedSitemap[]> => {
  let concatedLinks: string[];
  try {
    if (url === undefined || url === null) {
      return createCategorySitemaps(sitemap, categories);
    }

    urlsVisited.push(url);
    const response = await fetch(baseURL + url, { method: 'GET', redirect: 'manual' });
    const htmlDocument = await response.text();
    const newLinks = parseHtml(htmlDocument, baseURL);
    concatedLinks = links
      .concat(newLinks)
      .filter(onlyUnique)
      .filter((link) => !urlsVisited.includes(link));
    const nextLink = concatedLinks.shift();

    console.log('Current URL = ', url);
    console.log('Total URL Count = ', concatedLinks.length);

    const newSitemap = await addToSiteMap(htmlDocument, response, sitemap, baseURL + url, dateCallback);
    return visitLink(nextLink, baseURL, concatedLinks, urlsVisited, newSitemap, categories, dateCallback);
  } catch (error) {
    concatedLinks = links;
    const nextLink = concatedLinks.shift();
    return visitLink(nextLink, baseURL, concatedLinks, urlsVisited, sitemap, categories, dateCallback);
  }
};

const createFiles = (sitemaps: CategorisedSitemap[], baseURL: string, outputPath: string) => {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  fs.writeFileSync(path.join(outputPath, mainXmlFile), mainSitemapPrefix);

  sitemaps.forEach((sitemap) => {
    if (!fs.existsSync(path.join(outputPath, sitemap.path))) {
      fs.mkdirSync(path.join(outputPath, sitemap.path));
    }
    fs.writeFileSync(path.join(outputPath, sitemap.path, `${sitemap.name}.xml`), sitemap.data);
    if (sitemap.name === mainXmlFile.replace('.xml', '')) {
      return;
    }
    const mainXml = fs.readFileSync(path.join(outputPath, mainXmlFile));
    fs.writeFileSync(
      path.join(outputPath, mainXmlFile),
      `${mainXml}
  <sitemap>
    <loc>${baseURL}/${path.join(sitemap.path, sitemap.name)}.xml</loc>
    <lastmod>2024-09-06</lastmod>
  </sitemap>`,
    );
  });

  const mainXml = fs.readFileSync(path.join(outputPath, mainXmlFile));
  fs.writeFileSync(path.join(outputPath, mainXmlFile), `${mainXml}\n${mainSitemapPostfix}`);
};

const createCategorySitemaps = (sitemap: string, categories?: Category[]) => {
  if (!categories || categories.length === 0) {
    return [
      {
        name: mainXmlFile.replace('.xml', ''),
        path: '',
        data: sitemap,
      },
    ];
  }

  const sitemaps: CategorisedSitemap[] = [];
  let newSitemap = sitemap;

  newSitemap = newSitemap.replace(/<\/url>/g, '</url>\n,');
  newSitemap = newSitemap.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n', '');
  newSitemap = newSitemap.replace('</urlset>', '');
  const splitedUrls = newSitemap.split(',');

  splitedUrls.forEach((splitUrl) => {
    const url = splitUrl.match(/(?<=<loc>)[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\/\:]+(?=<\/loc>)/)?.[0];
    const lastmod = splitUrl.match(
      /(?<=<lastmod>)[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\/\:]+(?=<\/lastmod>)/,
    )?.[0];

    if (url === undefined || url === null) {
      return;
    }
    if (lastmod === undefined || lastmod === null) {
      return;
    }

    categories.forEach((category) => {
      if (category.include && !new RegExp(category.include).test(url)) {
        return;
      }
      if (category.exclude && new RegExp(category.exclude).test(url)) {
        return;
      }

      let categorisedSitemap: CategorisedSitemap;
      const existingSitemap = sitemaps.find((eachSitemap) => eachSitemap.name === category.label);
      if (existingSitemap) {
        categorisedSitemap = existingSitemap;
      } else {
        categorisedSitemap = {
          name: category.label,
          path: category.path,
          data: sitemapPrefix,
        };
        sitemaps.push(categorisedSitemap);
      }

      categorisedSitemap.data += `\n<url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
</url>`;
    });
  });

  sitemaps.forEach((eachSitemap) => {
    // eslint-disable-next-line no-param-reassign
    eachSitemap.data += `\n${sitemapPostfix}`;
  });

  return sitemaps;
};

export const crawl = async ({
  baseURL,
  outputPath,
  categories,
  dateCallback,
}: {
  baseURL: string;
  outputPath: string;
  categories?: Category[];
  dateCallback?: (urlParam: string) => Promise<string>;
}) => {
  try {
    const sitemaps = await visitLink('/', baseURL, [], [], sitemapPrefix, categories, dateCallback);
    createFiles(sitemaps, baseURL, outputPath);
  } catch (error) {
    console.log(error);
  }
};
