import { CachedItemStore } from '../../key-value-store';
import { Channel, ChannelDetailsRequest, Framework, FrameworkDetailsRequest, FrameworkService, OrganizationSearchCriteria } from '..';
import { FileService } from '../../util/file/def/file-service';
import { Observable } from 'rxjs';
import { Organization } from '../def/Organization';
import { ApiService } from '../../api';
import { SharedPreferences } from '../../util/shared-preferences';
import { SystemSettingsService } from '../../system-settings';
import { SdkConfig } from '../../sdk-config';
export declare class FrameworkServiceImpl implements FrameworkService {
    private sdkConfig;
    private fileService;
    private apiService;
    private cachedItemStore;
    private sharedPreferences;
    private systemSettingsService;
    private static readonly KEY_ACTIVE_CHANNEL_ID;
    private static readonly SEARCH_ORGANIZATION_ENDPOINT;
    private _activeChannelId?;
    constructor(sdkConfig: SdkConfig, fileService: FileService, apiService: ApiService, cachedItemStore: CachedItemStore, sharedPreferences: SharedPreferences, systemSettingsService: SystemSettingsService);
    readonly activeChannelId: string | undefined;
    preInit(): Observable<undefined>;
    getDefaultChannelDetails(): Observable<Channel>;
    getChannelDetails(request: ChannelDetailsRequest): Observable<Channel>;
    getFrameworkDetails(request: FrameworkDetailsRequest): Observable<Framework>;
    searchOrganization<T>(request: OrganizationSearchCriteria<T>): Observable<Organization<T>>;
    getActiveChannelId(): Observable<string>;
    setActiveChannelId(channelId: string): Observable<undefined>;
}
