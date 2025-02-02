import { Batch, ContentStateResponse, Course, CourseBatchDetailsRequest, CourseBatchesRequest, CourseService, EnrollCourseRequest, FetchEnrolledCourseRequest, GetContentStateRequest, UnenrollCourseRequest, UpdateContentStateRequest } from '..';
import { Observable } from 'rxjs';
import { ProfileService } from '../../profile';
import { KeyValueStore } from '../../key-value-store';
import { ApiService } from '../../api';
import { DbService } from '../../db';
import { SharedPreferences } from '../../util/shared-preferences';
import { SdkConfig } from '../../sdk-config';
import { DownloadCertificateRequest } from '../def/download-certificate-request';
import { AuthService } from '../../auth';
import { AppInfo } from '../../util/app';
import { DownloadCertificateResponse } from '../def/download-certificate-response';
export declare class CourseServiceImpl implements CourseService {
    private sdkConfig;
    private apiService;
    private profileService;
    private keyValueStore;
    private dbService;
    private sharedPreferences;
    private authService;
    private appInfo;
    static readonly GET_CONTENT_STATE_KEY_PREFIX: string;
    static readonly GET_ENROLLED_COURSE_KEY_PREFIX: string;
    static readonly UPDATE_CONTENT_STATE_KEY_PREFIX: string;
    static readonly LAST_READ_CONTENTID_PREFIX: string;
    private courseServiceConfig;
    constructor(sdkConfig: SdkConfig, apiService: ApiService, profileService: ProfileService, keyValueStore: KeyValueStore, dbService: DbService, sharedPreferences: SharedPreferences, authService: AuthService, appInfo: AppInfo);
    getBatchDetails(request: CourseBatchDetailsRequest): Observable<Batch>;
    updateContentState(request: UpdateContentStateRequest): Observable<boolean>;
    getCourseBatches(request: CourseBatchesRequest): Observable<Batch[]>;
    getEnrolledCourses(request: FetchEnrolledCourseRequest): Observable<Course[]>;
    enrollCourse(request: EnrollCourseRequest): Observable<boolean>;
    getContentState(request: GetContentStateRequest): Observable<ContentStateResponse | undefined>;
    unenrollCourse(unenrollCourseRequest: UnenrollCourseRequest): Observable<boolean>;
    checkContentStatus(request: GetContentStateRequest): Observable<number>;
    downloadCurrentProfileCourseCertificate(request: DownloadCertificateRequest): Observable<DownloadCertificateResponse>;
}
