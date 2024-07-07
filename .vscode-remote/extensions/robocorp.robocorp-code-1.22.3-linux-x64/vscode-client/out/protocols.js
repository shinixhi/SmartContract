"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandType = exports.ValidationStatus = exports.Format = exports.isSuccessful = exports.ConversionResultType = void 0;
// these declarations are a superficial variant of the implemented ones in the converter bundle
// they might need changes if the Converter API is changed
var ConversionResultType;
(function (ConversionResultType) {
    ConversionResultType["SUCCESS"] = "Success";
    ConversionResultType["FAILURE"] = "Failure";
})(ConversionResultType = exports.ConversionResultType || (exports.ConversionResultType = {}));
function isSuccessful(result) {
    return result.type === ConversionResultType.SUCCESS;
}
exports.isSuccessful = isSuccessful;
var Format;
(function (Format) {
    Format["BLUEPRISM"] = "blueprism";
    Format["A360"] = "a360";
    Format["UIPATH"] = "uipath";
    Format["AAV11"] = "aav11";
})(Format = exports.Format || (exports.Format = {}));
var ValidationStatus;
(function (ValidationStatus) {
    ValidationStatus["ValidationSuccess"] = "ValidationSuccess";
    ValidationStatus["ValidationError"] = "ValidationError";
})(ValidationStatus = exports.ValidationStatus || (exports.ValidationStatus = {}));
var CommandType;
(function (CommandType) {
    CommandType["Analyse"] = "Analyse";
    CommandType["Convert"] = "Convert";
    CommandType["Generate"] = "Generate";
    CommandType["Schema"] = "Schema";
})(CommandType = exports.CommandType || (exports.CommandType = {}));
//# sourceMappingURL=protocols.js.map