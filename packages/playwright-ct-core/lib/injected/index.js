"use strict";
var import_importRegistry = require("./importRegistry");
var import_serializers = require("./serializers");
window.__pwRegistry = new import_importRegistry.ImportRegistry();
window.__pwUnwrapObject = import_serializers.unwrapObject;
window.__pwTransformObject = import_serializers.transformObject;
