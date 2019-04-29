import {SharedPreferencesSetCollection} from '../def/shared-preferences-set-collection';
import {SharedPreferences} from '..';
import {Observable} from 'rxjs';
import * as Collections from 'typescript-collections';

export class SharedPreferencesSetCollectionImpl<T> implements SharedPreferencesSetCollection<T> {
    constructor(private sharedPreferences: SharedPreferences, private key: string, private toStringFunction?: (item: T) => string) {
    }

    addAll(items: T[]): Observable<void> {
        return this.asSet()
            .mergeMap((set: Collections.Set<T>) => {
                items.forEach((item) => set.add(item));

                return this.sharedPreferences.putString(this.key, JSON.stringify(set.toArray()))
                    .mapTo(undefined);
            });
    }

    add(item: T): Observable<void> {
        return this.asSet()
            .mergeMap((set: Collections.Set<T>) => {
                set.add(item);

                return this.sharedPreferences.putString(this.key, JSON.stringify(set.toArray()))
                    .mapTo(undefined);
            });
    }

    remove(item: T): Observable<boolean> {
        return this.asSet()
            .mergeMap((set: Collections.Set<T>) => {
                const hasRemoved = set.remove(item);

                return this.sharedPreferences.putString(this.key, JSON.stringify(set.toArray()))
                    .mapTo(hasRemoved);
            });
    }

    contains(item: T): Observable<boolean> {
        return this.asSet()
            .map((set) => {
                return set.contains(item);
            });
    }

    asList(): Observable<T[]> {
        return this.sharedPreferences.getString(this.key)
            .map((downloadListStringified?) => {
                if (!downloadListStringified) {
                    return [];
                }

                return JSON.parse(downloadListStringified);
            });
    }

    asSet(): Observable<Collections.Set<T>> {
        return this.asList()
            .map((items: T[]) => {
                return items.reduce((acc, item) => {
                    acc.add(item);
                    return acc;
                }, new Collections.Set<T>(this.toStringFunction));
            });
    }
}
