import {ContentEventType, FileName, ImportContentContext} from '../..';
import {Response} from '../../../api';
import {ContentDisposition, ContentEncoding, ContentStatus, MimeType, State, Visibility} from '../../util/content-constants';
import {FileService} from '../../../util/file/def/file-service';
import {DbService} from '../../../db';
import {ContentUtil} from '../../util/content-util';
import {GetContentDetailsHandler} from '../get-content-details-handler';
import {ContentEntry} from '../../db/schema';
import {ZipService} from '../../../util/zip/def/zip-service';
import {AppConfig} from '../../../api/config/app-config';
import {FileUtil} from '../../../util/file/util/file-util';
import {DeviceInfo} from '../../../util/device/def/device-info';
import {EventNamespace, EventsBusService} from '../../../events-bus';
import moment from 'moment';
import {ArrayUtil} from '../../../util/array-util';
import COLUMN_NAME_VISIBILITY = ContentEntry.COLUMN_NAME_VISIBILITY;

export class ExtractPayloads {

    constructor(private fileService: FileService,
                private zipService: ZipService,
                private appConfig: AppConfig,
                private dbService: DbService,
                private deviceInfo: DeviceInfo,
                private getContentDetailsHandler: GetContentDetailsHandler,
                private eventsBusService: EventsBusService) {
    }

    public async execute(importContext: ImportContentContext): Promise<Response> {
        const response: Response = new Response();
        importContext.identifiers = [];
        const insertNewContentModels: ContentEntry.SchemaMap[] = [];
        const updateNewContentModels: ContentEntry.SchemaMap[] = [];
        let rootContentPath;

        // this count is for maintaining how many contents are imported so far
        let currentCount = 0;
        // post event before starting with how many imports are to be done totally
        this.postImportProgressEvent(currentCount, importContext.items!.length);
        const contentIds: string[] = [];
        const nonUnitContentIds: string[] = [];
        for (const e of importContext.items!) {
            const item = e as any;
            const identifier = item.identifier;
            const visibility = ContentUtil.readVisibility(item);
            if (ContentUtil.isNotUnit(item.mimeType, visibility)) {
                nonUnitContentIds.push(identifier);
            }
            contentIds.push(identifier);
        }

        // await this.fileService.createDir(ContentUtil.getContentRootDir(importContext.destinationFolder), false);
        // Create all the directories for content.
        const createdDirectories = await this.createDirectories(ContentUtil.getContentRootDir(importContext.destinationFolder),
            nonUnitContentIds);

        const query = ArrayUtil.joinPreservingQuotes(contentIds);
        const existingContentModels = await this.getContentDetailsHandler.fetchFromDBForAll(query).toPromise();

        const result = existingContentModels.reduce((map, obj) => {
            map[obj.identifier] = obj;
            return map;
        }, {});

        for (const e of importContext.items!) {
            let item = e as any;
            const identifier = item.identifier;
            // skip the content if already imported on the same version
            if (importContext.skippedItemsIdentifier
                && importContext.skippedItemsIdentifier.indexOf(identifier) > -1) {
                continue;
            }
            const mimeType = item.mimeType;
            const contentEncoding = item.contentEncoding;
            const contentDisposition = item.contentDisposition;
            const contentType = ContentUtil.readContentType(item);
            let visibility = ContentUtil.readVisibility(item);
            const audience = ContentUtil.readAudience(item);
            const pragma = ContentUtil.readPragma(item);
            const compatibilityLevel = ContentUtil.readCompatibilityLevel(item);
            const pkgVersion = item.pkgVersion;
            const artifactUrl = item.artifactUrl;
            const appIcon = item.appIcon;
            const board = item.board;
            const medium = item.medium;
            const grade = item.gradeLevel;
            // const dialCodes = item.dialcodes;
            let contentState = State.ONLY_SPINE.valueOf();
            let payloadDestination: string | undefined;

            // const existingContentModel = await this.getContentDetailsHandler.fetchFromDB(identifier).toPromise();
            const existingContentModel = result[identifier];
            let existingContentPath;
            if (existingContentModel) {
                existingContentPath = ContentUtil.getBasePath(existingContentModel[ContentEntry.COLUMN_NAME_PATH]!);
            }

            let rootNodeIdentifier;
            if (visibility === Visibility.DEFAULT.valueOf()) {
                rootNodeIdentifier = identifier;
            }

            if (ContentUtil.isNotUnit(mimeType, visibility)) {
                if (createdDirectories[identifier] && createdDirectories[identifier].path) {
                    payloadDestination = createdDirectories[identifier].path;
                } else {
                    const payloadDestinationDirectoryEntry: DirectoryEntry = await this.fileService.createDir(
                        ContentUtil.getContentRootDir(importContext.destinationFolder).concat('/', identifier), false);
                    payloadDestination = payloadDestinationDirectoryEntry.nativeURL;
                }
            }

            let isUnzippingSuccessful = false;
            let doesContentExist: boolean = ContentUtil.doesContentExist(existingContentModel, identifier, pkgVersion, false);
            // If the content is exist then copy the old content data and add it into new content.
            if (doesContentExist && !(item.status === ContentStatus.DRAFT.valueOf())) {
                if (existingContentModel![COLUMN_NAME_VISIBILITY] === Visibility.DEFAULT.valueOf()) {
                    item = JSON.parse(existingContentModel![ContentEntry.COLUMN_NAME_LOCAL_DATA]);
                }
            } else {
                doesContentExist = false;

                if (ContentUtil.isCompatible(this.appConfig, compatibilityLevel)) {
                    // let isUnzippingSuccessful = false;
                    if (artifactUrl) {
                        if (!contentDisposition || !contentEncoding ||
                            (contentDisposition === ContentDisposition.INLINE.valueOf()
                                && contentEncoding === ContentEncoding.GZIP.valueOf())) { // Content with artifact without zip i.e. pfd, mp4
                            const payload = importContext.tmpLocation!.concat(artifactUrl);
                            await new Promise((resolve, reject) => {
                                this.zipService.unzip(payload, {target: payloadDestination!}, () => {
                                    isUnzippingSuccessful = true;
                                    resolve();
                                }, () => {
                                    resolve();
                                });
                            });
                        } else if (ContentUtil.isInlineIdentity(contentDisposition, contentEncoding)) {
                            try {
                                await this.copyAssets(importContext.tmpLocation!, artifactUrl, payloadDestination!);
                                isUnzippingSuccessful = true;
                            } catch (e) {
                                isUnzippingSuccessful = false;
                            }
                        } else if (ContentDisposition.ONLINE.valueOf() === contentDisposition) { // Content with no artifact)
                            isUnzippingSuccessful = true;
                        }
                    }

                    // Add or update the content_state
                    if (isUnzippingSuccessful    // If unzip is success it means artifact is available.
                        || MimeType.COLLECTION.valueOf() === mimeType) {
                        contentState = State.ARTIFACT_AVAILABLE.valueOf();
                    } else {
                        contentState = State.ONLY_SPINE.valueOf();
                    }
                }
                if (ContentUtil.isNotUnit(mimeType, visibility)) {
                    try {
                        if (!appIcon.startsWith('https:')) {
                            await this.copyAssets(importContext.tmpLocation!, appIcon, payloadDestination!);
                        }
                    } catch (e) {
                    }
                }
            }

            const basePath = this.getBasePath(payloadDestination, doesContentExist, existingContentPath);
            if (visibility === Visibility.DEFAULT.valueOf()) {
                rootContentPath = basePath;
                importContext.rootIdentifier = identifier;

            } else {
                if (ContentUtil.isNotUnit(mimeType, visibility)) {
                    importContext.identifiers.push(identifier);
                }
            }
            const referenceCount = this.getReferenceCount(existingContentModel, visibility,
                importContext.isChildContent, importContext.existedContentIdentifiers);
            visibility = this.getContentVisibility(existingContentModel, item['objectType'], importContext.isChildContent, visibility);
            // contentState = this.getContentState(existingContentModel, contentState);
            ContentUtil.addOrUpdateViralityMetadata(item, this.deviceInfo.getDeviceID().toString());

            let sizeOnDevice = 0;
            if (ContentUtil.isNotUnit(mimeType, visibility)) {
                try {
                    sizeOnDevice = await this.fileService.getDirectorySize(payloadDestination!);
                } catch (e) {
                }
            }

            const newContentModel: ContentEntry.SchemaMap = this.constructContentDBModel(identifier, importContext.manifestVersion,
                JSON.stringify(item), mimeType, contentType, visibility, basePath,
                referenceCount, contentState, audience, pragma, sizeOnDevice, board, medium, grade);
            if (!existingContentModel) {
                insertNewContentModels.push(newContentModel);
            } else {
                const existingContentState = this.getContentState(existingContentModel, contentState);
                if (existingContentState === State.ONLY_SPINE.valueOf()
                    || isUnzippingSuccessful    // If unzip is success it means artifact is available.
                    || MimeType.COLLECTION.valueOf() === mimeType) {
                    updateNewContentModels.push(newContentModel);
                }
            }

            // increase the current count
            currentCount++;
            this.postImportProgressEvent(currentCount, importContext.items!.length);
        }

        if (insertNewContentModels.length || updateNewContentModels.length) {
            this.dbService.beginTransaction();
            // Insert into DB
            for (const e of insertNewContentModels) {
                const newContentModel = e as ContentEntry.SchemaMap;
                await this.dbService.insert({
                    table: ContentEntry.TABLE_NAME,
                    modelJson: newContentModel
                }).toPromise();
            }

            // Update existing content in DB
            for (const e of updateNewContentModels) {
                const newContentModel = e as ContentEntry.SchemaMap;
                await this.dbService.update({
                    table: ContentEntry.TABLE_NAME,
                    selection: `${ContentEntry.COLUMN_NAME_IDENTIFIER} = ?`,
                    selectionArgs: [newContentModel[ContentEntry.COLUMN_NAME_IDENTIFIER]],
                    modelJson: newContentModel
                }).toPromise();
            }
            this.dbService.endTransaction(true);
        }

        if (rootContentPath) {
            await this.fileService.copyFile(importContext.tmpLocation!,
                FileName.MANIFEST.valueOf(),
                rootContentPath,
                FileName.MANIFEST.valueOf());
        }

        response.body = importContext;
        return Promise.resolve(response);
    }

    async copyAssets(tempLocationPath: string, asset: string, payloadDestinationPath: string) {
        try {
            if (asset) {
                // const iconSrc = tempLocationPath.concat(asset);
                // const iconDestination = payloadDestinationPath.concat(asset);
                const folderContainingFile = asset.substring(0, asset.lastIndexOf('/'));
                // TODO: Can optimize folder creation
                await this.fileService.createDir(payloadDestinationPath.concat(folderContainingFile), false);
                // If source icon is not available then copy assets is failing and throwing exception.
                await this.fileService.copyFile(tempLocationPath.concat(folderContainingFile), FileUtil.getFileName(asset),
                    payloadDestinationPath.concat(folderContainingFile), FileUtil.getFileName(asset));
            }

        } catch (e) {
            console.error('Cannot Copy Asset');
            throw e;
        }
    }

    /**
     * add or update the reference count for the content
     *
     */
    getContentVisibility(existingContentInDb, objectType, isChildContent: boolean, previousVisibility: string): string {
        let visibility;
        if ('Library' === objectType) {
            visibility = Visibility.PARENT.valueOf();
        } else if (existingContentInDb) {
            if (isChildContent     // If import started from child content then do not update the visibility.
                // If not started from child content then do not shrink visibility.
                || !(Visibility.PARENT.valueOf() === existingContentInDb[COLUMN_NAME_VISIBILITY])) {
                visibility = existingContentInDb[COLUMN_NAME_VISIBILITY];
            }
        }
        return visibility ? visibility : previousVisibility;
    }

    /**
     * Add or update the content_state. contentState should not update the spine_only when importing the spine content
     * after importing content with artifacts.
     *
     */
    getContentState(existingContentInDb, contentState: number): number {
        if (existingContentInDb && existingContentInDb[ContentEntry.COLUMN_NAME_CONTENT_STATE] > contentState) {
            contentState = existingContentInDb[ContentEntry.COLUMN_NAME_CONTENT_STATE];
        }
        return contentState;
    }

    getBasePath(payLoadDestinationPath, doesContentExist: boolean, existingContentPath: string): string {
        let path;
        if (payLoadDestinationPath && !doesContentExist) {
            path = payLoadDestinationPath;
        } else {
            path = existingContentPath;
        }
        return path;
    }

    /**
     * add or update the reference count for the content
     *
     */
    private getReferenceCount(existingContent, visibility: string, isChildContent: boolean,
                              updateIdentifiers?: { [identifier: string]: boolean }): number {
        let refCount: number;
        if (existingContent) {
            refCount = existingContent[ContentEntry.COLUMN_NAME_REF_COUNT];

            const found = updateIdentifiers ? updateIdentifiers[existingContent[ContentEntry.COLUMN_NAME_IDENTIFIER]] : undefined;
            if (found) {
                // Do not increase the refCount.
            } else if (!isChildContent) {    // If import started from child content then do not update the refCount.
                // if the content has a 'Default' visibility and update the same content then don't increase the reference count...
                if (!(Visibility.DEFAULT.valueOf() === existingContent[COLUMN_NAME_VISIBILITY]
                    && Visibility.DEFAULT.valueOf() === visibility)) {
                    refCount = refCount + 1;
                }
            }
        } else {
            refCount = 1;
        }
        return refCount;
    }

    private postImportProgressEvent(currentCount, totalCount) {
        this.eventsBusService.emit({
            namespace: EventNamespace.CONTENT,
            event: {
                type: ContentEventType.IMPORT_PROGRESS,
                payload: {
                    totalCount: totalCount,
                    currentCount: currentCount
                }
            }
        });
    }

    private constructContentDBModel(identifier, manifestVersion, localData,
                                    mimeType, contentType, visibility, path,
                                    refCount, contentState, audience, pragma, sizeOnDevice, board, medium, grade): ContentEntry.SchemaMap {
        return {
            [ContentEntry.COLUMN_NAME_IDENTIFIER]: identifier,
            [ContentEntry.COLUMN_NAME_SERVER_DATA]: '',
            [ContentEntry.COLUMN_NAME_PATH]: ContentUtil.getBasePath(path),
            [ContentEntry.COLUMN_NAME_REF_COUNT]: refCount,
            [ContentEntry.COLUMN_NAME_CONTENT_STATE]: contentState,
            [ContentEntry.COLUMN_NAME_SIZE_ON_DEVICE]: sizeOnDevice,
            [ContentEntry.COLUMN_NAME_MANIFEST_VERSION]: manifestVersion,
            [ContentEntry.COLUMN_NAME_LOCAL_DATA]: localData,
            [ContentEntry.COLUMN_NAME_MIME_TYPE]: mimeType,
            [ContentEntry.COLUMN_NAME_CONTENT_TYPE]: contentType,
            [ContentEntry.COLUMN_NAME_VISIBILITY]: visibility,
            [ContentEntry.COLUMN_NAME_AUDIENCE]: audience,
            [ContentEntry.COLUMN_NAME_PRAGMA]: pragma,
            [ContentEntry.COLUMN_NAME_LOCAL_LAST_UPDATED_ON]: moment(Date.now()).format('YYYY-MM-DDTHH:mm:ssZ'),
            [ContentEntry.COLUMN_NAME_BOARD]: ContentUtil.getContentAttribute(board),
            [ContentEntry.COLUMN_NAME_MEDIUM]: ContentUtil.getContentAttribute(medium),
            [ContentEntry.COLUMN_NAME_GRADE]: ContentUtil.getContentAttribute(grade)
        };
    }

    // TODO: move this method to file-service
    private async createDirectories(parentDirectoryPath: string,
                                    listOfFolder: string[]): Promise<{ [key: string]: { path: string | undefined } }> {
        return new Promise<{ [key: string]: { path: string | undefined } }>((resolve, reject) => {
            buildconfigreader.createDirectories(ContentUtil.getBasePath(parentDirectoryPath), listOfFolder,
                (entry) => {
                    resolve(entry);
                }, err => {
                    console.error(err);
                    reject(err);
                });
        });
    }

}
