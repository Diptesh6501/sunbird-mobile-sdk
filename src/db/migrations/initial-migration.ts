import {DbService, Migration} from '..';
import {EventPriorityEntry, TelemetryEntry, TelemetryProcessedEntry, TelemetryTagEntry} from '../../telemetry/db/schema';
import {ImportedMetadataEntry, LearnerAssessmentsEntry, LearnerSummaryEntry, ProfileEntry, UserEntry,} from '../../profile/db/schema';
import {GroupEntry, GroupProfileEntry} from '../../group/db/schema';
import {PartnerEntry} from '../../partner/db/schema';
import {ContentAccessEntry, ContentEntry, ContentFeedbackEntry, ContentMarkerEntry} from '../../content/db/schema';
import {NotificationEntry} from '../../notification/db/schema';
import {KeyValueStoreEntry} from '../../key-value-store/db/schema';
import {ErrorStackEntry} from '../../util/error-stack/db/schema';
import {SearchHistoryEntry} from '../../util/search-history/db/schema';

export class InitialMigration extends Migration {

    constructor() {
        super(1, 16);
    }

    public async apply(dbService: DbService): Promise<undefined> {
        await Promise.all(this.queries().map((query) => dbService.execute(query).toPromise()));
        return;
    }

    queries(): Array<string> {
        return [
            TelemetryEntry.getCreateEntry(),
            TelemetryProcessedEntry.getCreateEntry(),
            TelemetryTagEntry.getCreateEntry(),
            EventPriorityEntry.getCreateEntry(),
            UserEntry.getCreateEntry(),
            ProfileEntry.getCreateEntry(),
            ImportedMetadataEntry.getCreateEntry(),
            PartnerEntry.getCreateEntry(),
            ContentEntry.getCreateEntry(),
            LearnerAssessmentsEntry.getCreateEntry(),
            LearnerSummaryEntry.getCreateEntry(),
            ContentAccessEntry.getCreateEntry(),
            ContentFeedbackEntry.getCreateEntry(),
            NotificationEntry.getCreateEntry(),
            GroupEntry.getCreateEntry(),
            GroupProfileEntry.getCreateEntry(),
            KeyValueStoreEntry.getCreateEntry(),
            ContentMarkerEntry.getCreateEntry(),
            ErrorStackEntry.getCreateEntry(),
            SearchHistoryEntry.getCreateEntry()
        ];
    }


}
