import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { ShoppingListFactory, ShoppingListRepositoryPouchDB } from 'ibm-shopping-list-model'
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

@Injectable()
export class DbProvider {
 
  db: any;
  remoteDb: any;
  //remoteDbUrl: String = 'http://admin:pass@192.168.1.70:35984/shopping-list';
  remoteDbUrl: String = 'http://admin:pass@9.24.7.248:35984/shopping-list';
  shoppingListFactory: any;
  shoppingListRepository: any;
  syncSubject: Subject<any>;
 
  constructor() {
    PouchDB.plugin(PouchDBFind);
    this.db = new PouchDB('shopping-list');
    this.remoteDb = new PouchDB(this.remoteDbUrl);
    this.shoppingListFactory = new ShoppingListFactory(); 
    this.shoppingListRepository = new ShoppingListRepositoryPouchDB(this.db);
    this.shoppingListRepository.ensureIndexes();
    this.syncSubject = new Subject();
    this.db.sync(this.remoteDb, {
    	live:true,
    	retry:true
    }).on('change', (change) => {
      if (change.direction == "pull") {
        this.syncSubject.next(change);
      }
    }).on('error', (err) => {
      this.syncSubject.next(err);
    });
  }

  sync() {
    return this.syncSubject;
  }
 
  loadLists() {
    let lists = [];
    let listItemPromises = [];
    return this.shoppingListRepository.find()
      .then((allLists) => {
        for (let list of allLists.toArray()) {
          lists.push({listId: list._id, list: list, itemCount: 0, itemCheckedCount: 0, items: []});
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
        let item = this.shoppingListFactory.newShoppingListItem({title: text}, list);
        return this.shoppingListRepository.putItem(item);
      });
  }

  toggleItemChecked(item) {
      let checked = ! item.checked;
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