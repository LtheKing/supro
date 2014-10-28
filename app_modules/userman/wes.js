/*
 * Consume: http://$FQDN:$PORT/um/lib/wes
 *
 * Wait events from backend using "long pooling".
 * The request is pending until something is there.
 * Thus:
 * >
 * > App.um.wes(status)
 * >
 * will not response until *next* event from backend
 *
 *
 * @status is current user status from backend:
 * App.User.id: 'onlidev@127.0.0.1 BcORk11VGsInZtzrLHD0LtYy'
 *   user status:^^^^   |         |
 *      user auth id:^^^|         |
 *            IP address:^^^^^^^^^|
 *                 `req.sessionID`:^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * used in e.g. Chat to make this user bold
 *
 * If there is no pending `res` in session,
 * then user status is set `offline` ('appbar-user-offl')
 *
 * backend errors: w.res.statusCode = 501// "Not Implemented" + JSON
 *
 **/

App.um.wes = (
function create_backend_wait_events(conn){
var defaults
    /* channel#2: receive events from backend, send user status */
    conn.suspendEvents(false)// `this` fires own signal in callback()
    conn.url = App.backendURL + '/um/lib/wes'
    conn.timeout = App.cfg.extjs.wes.timeout || (1 << 22)// ~ hour
    conn.defer = null
    defaults = {
    // `wes` has only one polling `res` per `req.session`,
    // but to send new status second `req` is firing
        autoAbort: false,
        callback: backend_events
    }
    console.log('init: ' + App.User.id)
    req('onli')// setup user status by 'appbar-user-onli'

    return req// return function to act manually e.g: `App.um.wes(status)`

    function req(opts){
    var ev = 'initwes@UI'

        Ext.globalEvents.fireEventArgs(ev, [ ev ])

        if(!opts){
            opts = { }
        } else if('string' == typeof opts){// change status
            opts = { params: opts }
        }
        if(!opts.params){// if empty send current user status
            opts.params = App.User.id.slice(0, 4)
        }

        return conn.request(Ext.applyIf(opts, defaults))
    }

    function backend_events(o, success, res){
    var data, i, done

        if(success){
            // reset error state if any
            if(App.User.internalId){// tmp store for status in case of connection errors
                App.User.id = App.User.internalId// restore past status
                App.User.internalId = ''
            }
            if(conn.defer){
                clearTimeout(conn.defer)
                conn.defer = 0
            }
            // data processing
            if(!res.responseText) return req()// nothing to do
            try {
                data = JSON.parse(res.responseText)
            } catch(ex){
                success = false
                console.error('JSON App.um.wes:')
                console.error(res)
                Ext.Msg.show({
                   title: l10n.errun_title + ' JSON App.um.wes',
                   buttons: Ext.Msg.OK,
                   icon: Ext.Msg.ERROR,
                   msg:
('data: ' + (res.responseText || 'empty')).slice(0, 16).replace(/</g, '&lt;')
+'<br><b>'+ l10n.errun_stack + '</b>' + ex.stack.replace(/</g, '&lt;')
                })
            }
            if(!data || !data.length) return req()// nothing to do
            // handle own events
            i = data.length - 1
            done = 0
            do {// scan from bottom up (our event are likely to be last in list)
                switch(data[i].ev){
                case 'wes4store':
                    o = data[i].json
                    if(o && o.store){
                        res = Ext.StoreManager.lookup(o.store)// e.g.: 'lftpd'
                        if(res){
                            setTimeout(function deferStore_fireEventArgs(){
                                res.fireEventArgs('wes4store', [o])
                            }, 0)
                            done++
                        } else {
                            console.warn('`wes4store` not found: ' + o.store)
                        }
                    } else {
                        console.warn('`wes4store`: no `store` argument of event')
                    }
                break
                // broadcasts: 'login@um' 'initwes@um' 'usts@um' ....
                default: break
                // == private events ==
                case 'Usts@um':
                // assign backend's ID instead of autogenerated User Model's ID
                    o = data[i].json
                    if(o && App.User.id != o){
                        App.User.id = o// UI event is in `um.controller.Login`
                        App.User.internalId && (App.User.internalId = '')
                    }
                    if('initwes@um' != data[0].ev &&// this is 1st event
                     !(data[2] && 'login@um' == data[2].ev)){// this is 3d one
                        o = null// do not setup twice if not init
                        done += 2
                    }
                    done++
                }
            } while(i--)
            if(o) req()// setup wes for next events, if not manual status
            // broadcast !own event if there are more events
            return (done == data.length) ? undefined : Ext.globalEvents.fireEventArgs(
                'wes4UI',
                [ success, data ]
            )
        }

        if(res.timedout) return req()// just restart polling
        if(-1 == res.status){// abort
            console.warn('wes: abort detected')
            return req()// try to restart polling
        }

        console.error('wes:', res)

        if(!App.User.internalId){
            App.User.internalId = App.User.id// save current status
            // mark as offline in case of permanent error
            App.User.id = 'offl' + App.User.id.slice(4)
        }
        conn.defer = Ext.defer(// retry a bit later
            req,
            App.cfg.extjs.wes.defer || (1 << 17)// ~ two minutes
        )
        Ext.globalEvents.fireEventArgs(
            'wes4UI',
            [ success, res.statusText || 'Disconnect']
        )

        return undefined
    }
})(Ext.create(App.backend.Connection))

/*
 * Deliver server-pushed data to Ext.data.store's
 * `ev`: wes4store
 * @view:: highlight updated row(s)
 **/
Ext.define('App.store.WES',{
    extend: Ext.data.ArrayStore,
    view: null,// grid or panel with grid somewhere down
    listeners:{
        wes4store: function(json){//{ store: 'storeId', data:[{model}, {model}]}
        var view, data, model, updated, j

            if(this.view){
                if(!(view = this.view.view)){// is not grid with view
                    view = this.view.down('grid').view // look down for a grid
                }
            }
            if(Array.isArray(data = json.data)){
                for(j = 0; j < data.length; ++j){
                    if((model = this.getById(data[j].id))){
                        if((updated = model.set(data[j]))){
                            // inform interested parties
                            model.fireEventArgs('datachanged',[ model, updated ])
                            // if grid view available, highlight row
                            view && Ext.fly(
                                view.getNode(view.getRowId(model))
                            ).highlight('#77FF77',{
                                attr: 'backgroundColor',
                                duration: 512
                            })
                        }
                    }
                }
                data && data.length && this.fireEventArgs('datachanged')
            }
        }
    }
})
