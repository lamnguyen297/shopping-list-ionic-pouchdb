import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { ShoppingListFactory, ShoppingListRepositoryPouchDB } from 'ibm-shopping-list-model'
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

@Injectable()
export class DatastoreProvider {

  settingsDoc: any;
  settingsDB: any;
  shoppingListDB: any;
  shoppingListFactory: any;
  shoppingListRepository: any;
  activeSyncSubject: Subject<any>;
  activeSync: any;
  activeSyncUrl: string;

  constructor() {
    PouchDB.plugin(PouchDBFind);
    this.settingsDB = new PouchDB('settings');
    this.shoppingListDB = new PouchDB('shopping-list');
    this.shoppingListFactory = new ShoppingListFactory();
    this.shoppingListRepository = new ShoppingListRepositoryPouchDB(this.shoppingListDB);
    this.shoppingListRepository.ensureIndexes();
    this.activeSyncSubject = new Subject();
    this.settingsDB.get('settings')
      .then((doc) => {
        this.settingsDoc = doc;
        if (this.settingsDoc) {
          this.applySyncUrl(this.settingsDoc.syncUrl, false);
        }
      }).catch((err) => {
        // TODO:
        console.log(err);
      });
  }

  sync() {
    return this.activeSyncSubject;
  }

  startSync() {
    if (this.activeSync) {
      this.activeSync.cancel()
      this.activeSync = null;
    }
    if (this.activeSyncUrl && this.activeSyncUrl.length > 0) {
      const remoteDb = new PouchDB(this.activeSyncUrl);
      this.activeSync = this.shoppingListDB.sync(remoteDb, {
        live: true,
        retry: true
      }).on('change', (change) => {
        if (change.direction == "pull") {
          this.activeSyncSubject.next(change);
        }
      }).on('error', (err) => {
        this.activeSyncSubject.next(err);
      });
    }
  }

  updateSyncUrl(syncUrl: string) {
    this.applySyncUrl(syncUrl, true);
  }

  applySyncUrl(syncUrl: string, updateDB: boolean) {
    if (syncUrl != this.activeSyncUrl) {
      if (updateDB) {
        if (this.settingsDoc == null) {
          this.settingsDoc = {
            _id: 'settings',
            syncUrl: syncUrl
          }
        }
        else {
          this.settingsDoc["syncUrl"] = syncUrl;
        }
        this.settingsDB.put(this.settingsDoc)
          .then((response) => {
            this.activeSyncUrl = syncUrl;
            this.settingsDoc._id = response.id;
            this.settingsDoc._rev = response.rev;
            this.startSync();
          }).catch(function (err) {
            // TODO:
            console.log(err);
          });
      }
      else {
        this.activeSyncUrl = syncUrl;
        this.startSync();
      }
    }
  }

  loadLists() {
    let lists = [];
    let listItemPromises = [];
    return this.shoppingListRepository.find()
      .then((allLists) => {
        for (let list of allLists.toArray()) {
          lists.push({ listId: list._id, list: list, itemCount: 0, itemCheckedCount: 0, items: [] });
          listItemPromises.push(this.shoppingListRepository.findItems({
            selector: {
              type: 'item',
              list: list._id
            }
          }));
        }
        return Promise.all(listItemPromises);
      })
      .then((itemLists) => {
        for (let itemList of itemLists) {
          const itemArray = itemList.toArray();
          for (let item of itemArray) {
            for (let list of lists) {
              if (item.list == list.listId) {
                list.items.push(item);
                list.itemCount = list.itemCount + 1;
                if (item.checked) {
                  list.itemCheckedCount = list.itemCheckedCount + 1;
                }
                break;
              }
            }
          }
        }
        return lists;
      });
  }

  addList(title: String) {
    let list = this.shoppingListFactory.newShoppingList({
      title: title
    });
    return this.shoppingListRepository.put(list);
  }

  deleteList(list: any) {
    return this.shoppingListRepository.get(list._id)
      .then(list => {
        return this.shoppingListRepository.delete(list);
      });
  }

  loadActiveItems(listId: String) {
    return this.shoppingListRepository.findItems({
      selector: {
        type: "item",
        list: listId
      }
    })
      .then((items) => {
        return Promise.resolve(items.toArray())
      });
  }

  addItem(text: String, listId: String) {
    return this.shoppingListRepository.get(listId)
      .then(list => {
        let item = this.shoppingListFactory.newShoppingListItem({ title: text }, list);
        return this.shoppingListRepository.putItem(item);
      });
  }

  toggleItemChecked(item) {
    let checked = !item.checked;
    return this.shoppingListRepository.getItem(item._id)
      .then(item => {
        item = item.set('checked', checked);
        return this.shoppingListRepository.putItem(item);
      });
  }

  deleteItem(item: any) {
    return this.shoppingListRepository.getItem(item._id)
      .then(item => {
        return this.shoppingListRepository.deleteItem(item);
      });
  }
}