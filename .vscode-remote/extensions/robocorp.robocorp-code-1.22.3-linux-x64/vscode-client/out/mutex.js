"use strict";
// https://spin.atomicobject.com/2018/09/10/javascript-concurrency/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mutex = void 0;
/**
 * Use as:
 *
 *   return await mutex.dispatch(async () => {
 *      ...
 *   });
 */
class Mutex {
    constructor() {
        this.mutex = Promise.resolve();
    }
    lock() {
        let begin = (unlock) => { };
        this.mutex = this.mutex.then(() => {
            return new Promise(begin);
        });
        return new Promise((res) => {
            begin = res;
        });
    }
    async dispatch(fn) {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        }
        finally {
            unlock();
        }
    }
}
exports.Mutex = Mutex;
//# sourceMappingURL=mutex.js.map