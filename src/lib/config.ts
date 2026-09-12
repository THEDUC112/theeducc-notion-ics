import { ICalEventBusyStatus } from 'ical-generator';
import type { QueryDataSourceParameters } from '@notionhq/client/build/src/api-endpoints';

export default {
	dateProperty: 'Date',
	titleProperty: 'Name',
	locationProperty: 'Place',
	busy: ICalEventBusyStatus.FREE
} as {
	filter: Readonly<QueryDataSourceParameters['filter']>;
	dateProperty: Readonly<string>;
	titleProperty: Readonly<string>;
	locationProperty: Readonly<string>;
	busy: Readonly<ICalEventBusyStatus>;
};
