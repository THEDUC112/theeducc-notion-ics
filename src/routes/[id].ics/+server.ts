import ical from 'ical-generator';
import { Client } from '@notionhq/client';
import type {
	DatabaseObjectResponse,
	QueryDataSourceResponse
} from '@notionhq/client/build/src/api-endpoints';

import config from '$lib/config';
import { ACCESS_KEY, NOTION_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

export const trailingSlash = 'never';

const notion = new Client({ auth: NOTION_TOKEN, notionVersion: '2025-09-03' });

export const GET: RequestHandler = async ({ params, url }) => {
	const secret = url.searchParams.get('secret');
	if (secret !== ACCESS_KEY) {
		return new Response('Forbidden', { status: 403 });
	}

	const { id } = params;

	const databaseMetadata = (await notion.databases.retrieve({
		database_id: id
	})) as DatabaseObjectResponse;
	const dataSource = databaseMetadata.data_sources[0];

	const databaseEntries: any[] = [];
	let query: QueryDataSourceResponse | { has_more: true; next_cursor: undefined } = {
		has_more: true,
		next_cursor: undefined
	};
	while (query.has_more) {
		query = await notion.dataSources.query({
			data_source_id: dataSource.id,
			page_size: 100,
			start_cursor: query.next_cursor,
			filter: config.filter
		});
		databaseEntries.push(...query.results);
	}

	const filtered: {
		id: string;
		title: string;
		location: string;
		date: { start: string; end: string | null; time_zone: string | null };
	}[] = databaseEntries.flatMap((object) => {
		const dateProp = object.properties?.[config.dateProperty]?.date;
		if (!dateProp?.start) {
			return [];
		}

		// Lấy thuộc tính Place (hỗ trợ dạng Select hoặc Text)
		const placeProp = object.properties?.[config.locationProperty];
		const location =
			placeProp?.select?.name ??
			placeProp?.rich_text?.[0]?.plain_text ??
			placeProp?.rich_text?.[0]?.text?.content ??
			'';

		return [
			{
				id: object.id,
				title:
					object.properties?.[config.titleProperty]?.title?.[0]?.plain_text ??
					object.properties?.[config.titleProperty]?.title?.[0]?.text?.content ??
					'Untitled',
				date: dateProp,
				location
			}
		];
	});

	const calendar = ical({
		name: dataSource.name,
		prodId: { company: 'Tomi Chen', language: 'EN', product: 'notion-ics' }
	});

	filtered.forEach((event) => {
		const hasTime = event.date.start.includes('T');

		if (hasTime) {
			// Có mốc giờ cụ thể
			const startDate = new Date(event.date.start);
			const endDate = event.date.end ? new Date(event.date.end) : startDate;

			calendar.createEvent({
				id: event.id,
				summary: event.title,
				start: startDate,
				end: endDate,
				location: event.location,
				allDay: false,
				busystatus: config.busy
			});
		} else {
			// Sự kiện cả ngày (All-day)
			const [y1, m1, d1] = event.date.start.split('-').map(Number);
			const startDate = new Date(y1, m1 - 1, d1);

			let endDate = startDate;
			if (event.date.end) {
				const [y2, m2, d2] = event.date.end.split('-').map(Number);
				endDate = new Date(y2, m2 - 1, d2 + 1);
			}

			calendar.createEvent({
				id: event.id,
				summary: event.title,
				start: startDate,
				end: endDate,
				location: event.location,
				allDay: true,
				busystatus: config.busy
			});
		}
	});

	return new Response(calendar.toString(), {
		status: 200,
		headers: {
			'content-type': 'text/calendar'
		}
	});
};
