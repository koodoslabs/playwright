/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as fs from 'fs';

import type * as playwright from 'playwright-core';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = tab.requests();
    [...requests.entries()].forEach(([req, res]) => response.addResult(renderRequest(req, res)));
  },
});

const storeRequests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_store_network_requests',
    title: 'Store network requests',
    description: 'Stores all network requests since loading the page, grouped by URL with optional URL filtering',
    inputSchema: z.object({
      urlFilter: z.string().optional().describe('URL pattern to filter requests (supports wildcards with *)'),
    }),
    type: 'readOnly',
  },

  handle: async(tab, params, response) => {
    const requests = tab.requests();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Helper function to match URL patterns with wildcards
    const matchesUrlFilter = (url: string, filter: string): boolean => {
      if (!filter) return true;
      const regexPattern = filter
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
        .replace(/\\\*/g, '.*');                 // Convert * to .*
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(url);
    };

    // Filter requests based on URL pattern if provided
    const filteredRequests = [...requests.entries()].filter(([req]) =>
      matchesUrlFilter(req.url(), params.urlFilter || '')
    );

    // Group requests by URL
    const groupedRequests: Record<string, any[]> = {};

    for (const [req, res] of filteredRequests) {
      const url = req.url();

      // Try to get response body, handle errors gracefully
      let responseBody: string | null = null;
      if (res) {
        try {
          const bodyBuffer = await res.body();
          // Convert buffer to string, handle binary data
          const contentType = res.headers()['content-type'] || '';
          if (contentType.includes('json') || contentType.includes('text') || contentType.includes('html') || contentType.includes('xml') || contentType.includes('javascript')) {
            responseBody = bodyBuffer.toString('utf-8');
          } else {
            // For binary data, store as base64
            responseBody = `[Binary data - ${bodyBuffer.length} bytes - base64]: ${bodyBuffer.toString('base64')}`;
          }
        } catch (error) {
          // Body might not be available for certain responses (redirects, etc)
          responseBody = `[Body not available: ${error}]`;
        }
      }

      const requestData = {
        method: req.method(),
        headers: req.headers(),
        postData: req.postData(),
        timestamp: req.timing()?.requestStart || Date.now(),
        response: res ? {
          status: res.status(),
          statusText: res.statusText(),
          headers: res.headers(),
          ok: res.ok(),
          url: res.url(),
          body: responseBody,
        } : null,
      };

      if (!groupedRequests[url]) {
        groupedRequests[url] = [];
      }
      groupedRequests[url].push(requestData);
    }

    // Create one file per URL
    const savedFiles: string[] = [];
    for (const [url, requestsForUrl] of Object.entries(groupedRequests)) {
      // Create a safe filename from the URL
      const urlObj = new URL(url);
      const safeName = `${urlObj.hostname}${urlObj.pathname}${urlObj.search}`
        .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace non-alphanumeric chars with underscore
        .replace(/_+/g, '_')               // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '')           // Trim underscores from start/end
        .substring(0, 100);                // Limit length

      const fileName = await tab.context.outputFile(`requests-${safeName}-${timestamp}.json`);

      const fileContent = {
        url,
        totalRequests: requestsForUrl.length,
        timestamp: new Date().toISOString(),
        requests: requestsForUrl,
      };

      await fs.promises.writeFile(fileName, JSON.stringify(fileContent, null, 2));
      savedFiles.push(fileName);
    }

    const filterMsg = params.urlFilter ? ` matching "${params.urlFilter}"` : '';
    response.addResult(`Stored ${filteredRequests.length} network requests${filterMsg} in ${savedFiles.length} files (one per unique URL)`);
  },
});

const storeDom = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_store_dom',
    title: 'Store page DOM',
    description: 'Stores the current page HTML/DOM content to a file',
    inputSchema: z.object({
      filename: z.string().optional().describe('File name to save the DOM to. Defaults to page-dom-{timestamp}.html if not specified.'),
      includeStyles: z.boolean().optional().default(true).describe('Whether to include computed styles for elements'),
    }),
    type: 'readOnly',
  },

  handle: async(tab, params, response) => {
    const fileName = await tab.context.outputFile(params.filename ?? `page-dom-${new Date().toISOString().replace(/[:.]/g, '-')}.html`);

    let htmlContent: string;

    if (params.includeStyles) {
      // Get the full HTML with computed styles
      htmlContent = await tab.page.evaluate(() => {
        const cloneDocument = document.cloneNode(true) as Document;
        const elements = cloneDocument.querySelectorAll('*');

        // Add computed styles to each element
        elements.forEach((element, index) => {
          const originalElement = document.querySelectorAll('*')[index];
          if (originalElement && originalElement instanceof HTMLElement) {
            const computedStyle = window.getComputedStyle(originalElement);
            let styleStr = '';
            for (let i = 0; i < computedStyle.length; i++) {
              const prop = computedStyle[i];
              styleStr += `${prop}: ${computedStyle.getPropertyValue(prop)}; `;
            }
            (element as HTMLElement).setAttribute('data-computed-style', styleStr);
          }
        });

        return cloneDocument.documentElement.outerHTML;
      });
    } else {
      // Get just the basic HTML content
      htmlContent = await tab.page.content();
    }

    // Add metadata comment at the top
    const metadata = `<!--
DOM captured at: ${new Date().toISOString()}
Page URL: ${tab.page.url()}
Page Title: ${await tab.page.title()}
Include Styles: ${params.includeStyles}
-->
`;

    const fullContent = metadata + htmlContent;
    await fs.promises.writeFile(fileName, fullContent);

    const styleMsg = params.includeStyles ? ' (with computed styles)' : '';
    response.addResult(`Stored page DOM${styleMsg} to ${fileName}`);
  },
});

function renderRequest(request: playwright.Request, response: playwright.Response | null) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  return result.join(' ');
}

export default [
  requests,
  storeRequests,
  storeDom,
];
