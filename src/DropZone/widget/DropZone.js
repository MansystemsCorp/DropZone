define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/dom-construct",
	"dojo/on",
    "dojo/_base/lang",
	"DropZone/widget/lib/dropzone",
	"mxui/dom"
], function (declare, _WidgetBase, domConstruct, on, dojoLang, _Dropzone, dom) {
    "use strict";
    return declare("DropZone.widget.DropZone", [_WidgetBase], {
        imageentity: "",
        maxFileSize: 0,
        onChangemf: "",
        contextassociation: "",
        panelheight: 200,
        panelwidth: 500,
        buttoncaption: "upload",
        uploadButton: null,
        dropzone: null,
        parallelUploads: 4,
		_contextObj: null,

        constructor: function () {
            this.dropzone = null;
            this._contextObj = null;
        },

        postCreate: function () {
			dom.addCss('widgets/Dropzone/widget/css/dropzone.css');
            this.initDropZone();
        },

        update: function (obj, callback) {
            this._contextObj = obj;
            if (callback) {
				callback();
			};
        },

        initDropZone: function () {
            domConstruct.empty(this.domNode);
            if (!this.autoUpload) {
                this.uploadButton = dom.create('Button', {
					type: 'button', 
					class: 'btn mx-button btn-primary', 
                    icon: "mxclientsystem/mxui/widget/styles/images/MxFileInput/uploading.gif"
                });
				this.uploadButton.innerHTML = this.buttoncaption;
				on(this.uploadButton, "click", dojoLang.hitch(this, this.onclickEvent));
				logger.debug("button", this.uploadButton, this.buttonCaption);
                this.domNode.appendChild(this.uploadButton);
            }
            var height = (this.panelheight == 0) ? 'auto' : this.panelheight + 'px;';
            var width = (this.panelwidth ==0) ? 'auto' : this.panelwidth + 'px;';
            this.domNode.appendChild(dom.create("div", {
                "id": this.id + "_zone",
				"class": "dropzone",
				"style": 'height: ' + height + 'width: ' + width
            }));
            this.dropzone = new _Dropzone("#" + this.id + "_zone", {
                autoDiscover: false, 
                maxFilesize: this.maxFileSize,
                url: dojoLang.hitch(this, this.getMendixURL),
                paramName: "blob",
                autoProcessQueue: this.autoUpload,
                addRemoveLinks: true,
                accept: dojoLang.hitch(this, this.accept),
                parallelUploads: this.parallelUploads,
				headers: {
					'X-Csrf-Token': mx.session.sessionData.csrftoken,
					'X-Requested-With': 'XMLHttpRequest'
				}
            });
            this.dropzone.on("success", dojoLang.hitch(this, this.onComplete));
            this.dropzone.on("error", dojoLang.hitch(this, this.onError));
            this.dropzone.on("removedfile", dojoLang.hitch(this, this.onRemoveFile));
			this.dropzone.on("sending", dojoLang.hitch(this, this.addFormData));
			
        },
	
		addFormData: function(data, xhr, formData) {
			// Mendix 7 expects a data part.
			var s = '{"changes":{},"objects":[]}';
			formData.append("data", s);
		},

        getMendixURL: function (files) {
            return "/file?guid=" + files[0].obj.getGuid() + "&maxFileSize=" + this.maxFileSize + "&height=75&width=100";
        },

        onError: function (file, message) {
            this.onRemoveFile(file);
        },

        onRemoveFile: function (file, message) {
            if (this._beingDestroyed) {
                // dont remove the files when the widget is being destroyed by the uninitialize function.
                return;
            }
            var obj = file.obj;
            if (obj && this.onRemove) {
                mx.data.action({
                    params: {
                        actionname: this.onRemove,
                        applyto: "selection",
                        guids: [obj.getGuid()]
                    },
                    origin: this.mxform,
                    callback: dojoLang.hitch(this, function (result) {
                        file.obj = null;
                    }),
                    error: function (e) {
                        logger.error("onRemoveFile", e);
                    }
                });
            } else {
                this.removeFile(file);
            }
		},
        onComplete: function (file, message) {
            if (file.obj) {
                mx.data.commit({
                    mxobj: file.obj,
                    callback: dojoLang.hitch(this, function () {
                        logger.debug("onComplete");
                        this.callOnChange(file.obj);
                    })
                });
            }
            if (!this.autoUpload) {
				this.dropzone.processQueue(); 
			}
        },
        accept: function (file, callback) {
            this.createMendixFile(file, dojoLang.hitch(this, function () {
                this.acceptMendix(file, callback);
            }));
        },
        acceptMendix: function (file, callback) {
            var rejectcaption = this.rejectcaption || "rejected";
            if (file.obj && this.onAccept) {
                mx.data.action({
                    params: {
                        actionname: this.onAccept,
                        applyto: "selection",
                        guids: [file.obj.getGuid()]
                    },
                    origin: this.mxform,
                    callback: dojoLang.hitch(this, function (result) {
                        if (!result) {
                            callback(rejectcaption);
                        } else {
                            callback();
                        }
                    }),
                    error: function (e) {
                        logger.error("addedFile", e);
                    }
                });
            } else {
                callback();
            }
        },
        createMendixFile: function (file, callback) {
            mx.data.create({
                entity: this.imageentity,
                callback: dojoLang.hitch(this, function (obj) {
					logger.debug('create', obj);
                    var ref = this.contextassociation.split("/");
                    if (obj.has(ref[0])) {
                        obj.set(ref[0], this._contextObj.getGuid());
                    }
                    obj.set(this.nameattr, file.name);
                    if (this.sizeattr) {
                        obj.set(this.sizeattr, file.size);
                    }
                    if (this.typeattr) {
                        obj.set(this.typeattr, file.type);
                    }
                    file.obj = obj;
					mx.data.saveDocument(
						file.obj.getGuid(), 
						file.obj.name, 
						{ width: 100, height: 75 }, 
						file, 
						function(obj) {
							callback();
						}, function(e) {
							callback();
					});		 
						
                }),
                error: function () {
                    callback();
                }
            });
		},

        removeFile: function (file) {
            if (file.obj) {
                mx.data.remove({
                    guid: file.obj.getGuid(),
                    callback: function () {
                        mx.data.update({
							entity: file.obj.getEntity()
						}); 
                        file.obj = null;
                    },
                    error: function (err) {
                        logger.debug("Error occurred attempting to remove object " + err);
                    }
                });
            }
        },

        onclickEvent: function () {
            this.dropzone.processQueue(); 
        },

        callOnChange: function (obj) {
            if (obj && this.onChangemf) {
                mx.data.action({
                    params: {
                        actionname: this.onChangemf,
                        applyto: "selection",
                        guids: [obj.getGuid()]
                    },
                    origin: this.mxform,
                    callback: dojoLang.hitch(this, function () {
                        logger.debug("callOnChange");
                    }),
                    error: function (e) {
                        logger.error("callOnChange", e);
                    }
                });
            }
        },

        uninitialize: function () {
            if (this.dropzone) {
                this.dropzone.destroy();
            }
        }
    });
});
