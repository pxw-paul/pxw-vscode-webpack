'use strict';

/**
 * @class Cache
 * @desc A module for use in developing a Visual Studio Code extension. It allows an extension to cache values across sessions with optional expiration times using the ExtensionContext.globalState.
 * @param {vscode.ExtensionContext} context - The Visual Studio Code extension context
 * @param {string} [namespace] - Optional namespace for cached items. Defaults to "cache"
 * @returns {Cache} The cache object
 */
/*let Cache = function (context, namespace) {
  if (!context) {
    return undefined;
  }

  // ExtensionContext
  this.context = context;

  // Namespace of the context's globalState
  this.namespace = namespace || 'cache';

  // Local cache object
  this.cache = this.context.globalState.get(this.namespace, {});
}
*/
export class Cache {
  context:any;
  namespace:any;
  cache:any;
  constructor(context:any, namespace:string) {
    //if (!context) {
    //  return undefined;
    //}

    // ExtensionContext
    this.context = context;

    // Namespace of the context's globalState
    this.namespace = namespace || 'cache';

    // Local cache object
    this.cache = this.context.globalState.get(this.namespace, {});
  }





  /**
   * @name Cache#put
   * @method
   * @desc Store an item in the cache, with optional expiration
   * @param {string} key - The unique key for the cached item
   * @param {any} value - The value to cache
   * @param {number} [expiration] - Optional expiration time in seconds
   * @returns {Promise} Visual Studio Code Thenable (Promise)
   */
  put(key:string, value:string, expiration:string) {

    // Parameter type checking
    if (typeof (key) !== 'string' || typeof (value) === 'undefined') {
      return new Promise((resolve, reject) => {
        resolve(false);
      });
    }

    let obj = {
      value: value,
      expiration : ""
    };

    // Set expiration
    if (Number.isInteger(expiration)) {
      obj.expiration = this.now() + expiration;
    }

    // Save to local cache object
    this.cache[key] = obj;

    // Save to extension's globalState
    return this.context.globalState.update(this.namespace, this.cache);
  }

  /**
   * @name Cache#get
   * @desc Get an item from the cache, or the optional default value
   * @function
   * @param {string} key - The unique key for the cached item
   * @param {any} [defaultValue] - The optional default value to return if the cached item does not exist or is expired
   * @returns {any} Returns the cached value or optional defaultValue
   */
  get(key:string, defaultValue:any) {

    // If doesn't exist
    if (typeof (this.cache[key]) === 'undefined') {

      // Return default value
      if (typeof (defaultValue) !== 'undefined') {
        return defaultValue;
      } else {
        return undefined;
      }

    } else {
      // Is item expired?
      if (this.isExpired(key)) {
        return undefined;
      }
      // Otherwise return the value
      return this.cache[key].value;
    }
  }

  /**
   * @name Cache#has
   * @desc Checks to see if unexpired item exists in the cache
   * @function
   * @param {string} key - The unique key for the cached item
   * @return {boolean}
   */
  has(key:string) {
    if (typeof (this.cache[key]) === 'undefined') {
      return false;
    } else {
      return this.isExpired(key) ? false : true;
    }
  }

  /**
   * @name Cache#forget
   * @desc Removes an item from the cache
   * @function
   * @param {string} key - The unique key for the cached item
   * @returns {Thenable} Visual Studio Code Thenable (Promise)
   */
  forget(key:string) {
    // Does item exist?
    if (typeof (this.cache[key]) === 'undefined') {
      return new Promise(function (resolve, reject) {
        resolve(true);
      });
    }

    // Delete from local object
    delete this.cache[key];

    // Update the extension's globalState
    return this.context.globalState.update(this.namespace, this.cache);
  }


  /**
   * @name Cache#keys
   * @desc Get an array of all cached item keys
   * @function
   * @return {string[]}
   */
  keys() {
    return Object.keys(this.cache);
  }

  /**
   * @name Cache#all
   * @desc Returns object of all cached items
   * @function
   * @return {object}
   */
  all() {
    let items:any = {};
    for (let key in this.cache) {
      items[key] = this.cache[key].value;
    }
    return items;
  }


  /**
   * @name Cache#flush
   * @desc Clears all items from the cache
   * @function
   * @returns {Thenable} Visual Studio Code Thenable (Promise)
   */
  flush() {
    this.cache = {};
    return this.context.globalState.update(this.namespace, undefined);
  }



  /**
   * @name Cache#expiration
   * @desc Gets the expiration time for the cached item
   * @function
   * @param {string} key - The unique key for the cached item
   * @return {number} Unix Timestamp in seconds
   */
  getExpiration(key:string) {
    if (typeof (this.cache[key]) === 'undefined' || typeof (this.cache[key].expiration) === 'undefined') {
      return undefined;
    } else {
      return this.cache[key].expiration;
    }
  }

  /**
   * @name Cache#isExpired
   * @desc Checks to see if cached item is expired
   * @function
   * @param {object} item - Cached item object
   * @return {boolean}
   */
  isExpired(key:string) {
    return false;
/*    // If key doesn't exist or it has no expiration
    if (typeof (this.cache[key]) === 'undefined' || typeof (this.cache[key].expiration) === 'undefined') {
      return false;
    } else {

      // Is expiration >= right now?
      return this.now() >= this.cache[key].expiration;
    }
      */
  }

  /**
   * @name now
   * @desc Helpfer function to get the current timestamp
   * @function
   * @private
   * @return {number} Current Unix Timestamp in seconds
   */
  now() {
    return Math.floor(Date.now() / 1000);
  }
}

//module.exports = Cache;