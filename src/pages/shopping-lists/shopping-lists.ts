import { Component } from '@angular/core';
import { NavController, NavParams, AlertController } from 'ionic-angular';
import { ShoppingListPage } from '../../pages/shopping-list/shopping-list'
import { DbProvider } from '../../providers/db/db'

@Component({
  selector: 'page-shopping-lists',
  templateUrl: 'shopping-lists.html'
})
export class ShoppingListsPage {

  shopping_lists: any[] = [];

  constructor(public navCtrl: NavController, public navParams: NavParams, public alertCtrl: AlertController, public dbProvider: DbProvider) {
    this.dbProvider.loadLists().then(listMetas => {
      this.shopping_lists = listMetas;
    })
  }

  getItemsChecked(list) {
    let itemsString = '';
    if (list.itemCount == 0) {
      itemsString = '0 items';
    }
    else if (list.itemCount == 1) {
      itemsString = `1 item ${list.itemCheckedCount > 0 ? '' : 'un'}checked.`;
    }
    else {
      itemsString = `${list.itemCheckedCount} of ${list.itemCount} items checked.`;
    }
    return itemsString;
  }

  listTapped(event, listMeta) {
    let list = listMeta.list;
    this.navCtrl.push(ShoppingListPage, {
      list: list
    });
  }

  addList(event) {
    let prompt = this.alertCtrl.create({
      title: 'Add New Shopping List',
      inputs: [{
        name: 'title',
        placeholder: 'Name of shopping list'
      }],
      buttons: [
        {
          text: 'Cancel'
        },
        {
          text: 'Add',
          handler: data => {
            this.dbProvider.addList(data.title).then(list => {
              this.shopping_lists.push({ listId: list._id, list: list, itemCount: 0, itemCheckedCount: 0, items: [] });
            }).catch(err => {
              console.log(err);
            });
          }
        }
      ]
    });
    prompt.present();
  }

  removeList(event, listMeta) {
    this.dbProvider.deleteList(listMeta.list).then(list => {
      let index = this.shopping_lists.findIndex((lm, i) => {
        return lm.list._id === list._id
      });
      if (index > -1) {
        this.shopping_lists.splice(index, 1);
      }
    }).catch(function (err) {
      console.log(err);
    });
  }
}