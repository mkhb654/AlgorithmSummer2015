/**
 * Copyright 2012-2015 Evernote Corporation. All rights reserved.
 */
/*
 * The r.js inliner looks for "require.config(" in the mainConfigFile. requirejs in the
 * browser needs a require.config call. requirejs in the nodejs test runner needs the
 * config object exported. In order to satisfy all three of these uses of config-require,
 * we create a function on the require object called 'config' for nodejs, and use it to
 * store the config object, which we can then export.
 */

// define the config function for nodejs
if (typeof require.config === "undefined") {
  require.config = function(config) {
    this.configObject = config;
  }
  // this will allow us to export the config object
  require.getConfig = function() {
    return this.configObject;
  }
}

require.config({
  baseUrl : "/redesign/global/js",
  config : {
    "moment" : {
      noGlobal : true
    },
    "text" : {
    }
  },
  map: {
    '*': {
      'css': 'requirePlugins/require-css/css' // or whatever the path to require-css is
    }
  },
  paths : {
    /* In Alphabetical Order */
    "adyen-encrypt":"adyen/adyen.encrypt",
    "aes-crypto" : "aes-crypto",
    "AmazonHelpUrls" : "util/AmazonHelpUrls",
    "auto-approve-domains" : "auto-approve-domains",
    "backbone" : "backbone",
    "billing" : "evernoteClient/Billing",
    "binary-utils" : "binary-utils",
    "businessEmailInviteBox" : "businessEmailInviteBox",
    "market-cart" : "cart",
    "CarrierBillingExperimentHelper" : "CarrierBillingExperimentHelper",
    "checkout" : "evernoteClient/Checkout",
    "cnc-trie" : "../../ClipNCiteAction/Trie",
    "cnc-common-selector" : "../../ClipNCiteAction/CommonSelector",
    "cnc-notebook-selector" : "../../ClipNCiteAction/NotebookSelector",
    "cnc-tag-selector" : "../../ClipNCiteAction/TagSelector",
    "collapse" : "collapse",
    "common" : "basejs/common",
    "contacts-autocomplete" : "evernoteClient/Contacts.autocomplete",
    "cookies" : "cookies",
    "customize-sponsor" : "evernoteClient/customize_sponsor",
    "dataTableRequest" : "evernoteClient/JQueryDataTableRequest",
    "dataTableResponse" : "evernoteClient/JQueryDataTableResponse",
    "decrypt" : "decrypt",
    "domReady" : "requirePlugins/domReady",
    "easyXDM" : "easyXDM/easyXDM.min",
    "EmailInputBase" : "component/EmailInput",
    "EmailInput" : "component/EmailInput/EmailInput",
    "EventEmitter" : "node/EventEmitter",
    "SingleEmailInput" : "component/EmailInput/SingleEmailInput",
    "BulkEmailInput" : "component/EmailInput/BulkEmailInput",
    "emailParser" : "emailParser/emailParser",
    "en-locale" : "en-locale",
    "enquire" : "enquire",
    "EnforceAuthentication" : "component/EnforceAuthentication/EnforceAuthentication",
    "es6" : "basejs/es6",
    "EvernoteAdyenEncrypt" : "EvernoteAdyenEncrypt",
    "EvernoteTextField": "ReactFormComponents/EvernoteTextField",
    "experiment" : "experiment",
    "FapiaoInput" : "component/FapiaoInput/FapiaoInput",
    "fieldValidator" : "fieldvalidator",
    "first-launch" : "first-launch",
    "flash-detect" : "flash_detect",
    "flip" : "jquery.flip.min",
    "FluxDispatcher": "react-dispatcher-2.0.2",
    "ga-util" : "ga-util",
    "go-premium-dialog" : "GoPremiumDialog/go-premium-dialog",
    "googleConnect" : "googleConnect",
    "GoogleTagManager" : "component/GoogleTagManager/GoogleTagManager",
    "hashtable" : "hashtable",
    "hashset" : "hashset",
    "header" : "header",
    "heap" : "heap",
    "helpIconFix" : "helpiconfix",
    "i18n" : "evernoteClient/i18n2",
    "ImageGalleryBase" : "component/ImageGallery",
    "imageGallery" : "component/ImageGallery/imageGallery",
    "Immutable" : "immutable.min",
    "incompatibleBrowserDialog" : "component/IncompatibleBrowserDialog/incompatibleBrowserDialog",
    "InternalTestingWarning" : "component/InternalTestingWarning/InternalTestingWarning",
    "interwindow-message-queue" : "interwindow-message-queue",
    "jquery" : "basejs/jquery-1.8.0",
    "jquery-autoresize" : "jquery/autoresize.jquery.min",
    "jquery-fileupload" : "file-upload/jquery.fileupload",
    "jquery-iframe-transport" : "file-upload/jquery.iframe-transport",
    "jquery-jcrop" : "jcrop/jquery.Jcrop",
    "jquery-ui" : "jquery/ui/jquery-ui-1.9.2.custom.min",
    "jquery-form" : "jquery/jquery.form",
    "jquery-serializeObject" : "jquery/jquery.serializeObject",
    "jquery-tap" : "jquery/jquery.tap",
    "jqueryENDatatables" : "jquery.evernote_dataTables.min",
    "json2" : "json2/json2.min",
    "jsonrpc" : "jsonrpc-1.3.1/jsonrpc",
    "KeyCode" : "KeyCode",
    "KeyHandler" : "KeyHandlerPlugins",
    "Layout" : "util/Layout",
    "LightboxBase" : "component/Lightbox",
    "lightbox" : "component/Lightbox/lightbox",
    "linkedNotebooksHelper" : "linked-notebooks",
    "local-storage" : "local-storage",
    "lodash" : "lodash",
    "lozenge" : "lozenge/lozenge",
    "manageSponsor" : "evernoteClient/manageSponsorUsers2",
    "market-header" : "marketHeader",
    "market-yxbj-messaging" : "marketYXBJMessaging",
    "market-tracking" : "marketTracking",
    "MarketCartSummary" : "component/MarketCartSummary/MarketCartSummary",
    "MarketCheckoutSuccessTrackingBase" : "component/MarketCheckoutSuccessTracking",
    "MarketCheckoutSuccessTracking" : "component/MarketCheckoutSuccessTracking/MarketCheckoutSuccessTracking",
    "message-queue" : "en-message-queue",
    "mobile-checkout-flow" : "mobile-checkout-flow",
    "moment" : "moment/moment",
    "moment-lang" : "moment/lang",
    "moment-l10n" : "moment/moment-l10n",
    "NativeEventEmitter" : "NativeEventEmitter",
    "paginate" : "paginate",
    "PaymentMethodSelector" : "component/PaymentMethodSelector/PaymentMethodSelector",
    "PaymentProvider" : "util/PaymentProvider",
    "parse-util" : "emailParser/parse-util",
    "parse-names" : "parse-names",
    "password-strength" : "password-strength",
    "pdf" : "pdf",
    "pdf-compatibility" : "pdf-compatibility",
    "pdf-renderer" : "pdf-renderer",
    "pdf-worker" : "pdf-worker",
    "preconditions" : "preconditions",
    "premiumCopyExperimentHelper" : "premiumCopyExperimentHelper",
    "priceVariantHelper" : "priceVariantHelper",
    "quick-register" : "quick-register",
    // This is the development version of React, which contains code
    // that breaks in IE8, so it's not sufficient just to minify it for production.
    // The production version will be swapped in transparently at optimization time.
    // Any time the react version is updated, you must also update the .min sibling
    // file and update the config value in src/main/scripts/optimize_js.py
    "react" : "reactjs/react-with-addons-0.13.2",
    "react-infinite" : "react-infinite/react-infinite",
    "recent-contacts" : "recent-contacts",
    "react-router": "react-router-0.13.3.min",
    "RegistrationCheckModule" : "../../modules/RegistrationCheck/RegistrationCheckModule",
    "registration-helper" : "registration-helper",
    "resolve" : "requirePlugins/requirejs-promise",
    "responsiveTables" : "responsiveTables/responsive-tables",
    "security" : "security",
    "SelectBox" : "SelectBox/SelectBox",
    "SelectorBuilder" : "SelectorBuilder",
    "SeoulPatch" : "SeoulPatch",
    "SharingMenuBase" : "component/SharingMenu",
    "SharingMenu" : "component/SharingMenu/SharingMenu",
    "sjlc" : "sjlc",
    "shared-notebooks" : "shared-notebooks",
    "shared-notes" : "shared-notes",
    "simpledateformat" : "simpledateformat",
    "SkuPeriod" : "util/SkuPeriod",
    "sponsorCheckout" : "evernoteClient/SponsorCheckout",
    "sponsor-uri-check" : "evernoteClient/sponsor_uri_check",
    "Stopwatch" : "Stopwatch",
    "StringAffixer" : "util/StringAffixer",
    "StripesFieldModifier" : "StripesUtils/StripesFieldModifier",
    "templates" : "icanhaz",
    "text" : "requirePlugins/text",
    "textext" : "textExt_1.3.0",
    "Toasts" : "component/Toasts/Toasts",
    "exponential-counter" : "exponential-counter",
    "touchswipe" : "touchswipe",
    "tinycarousel" : "jquery.tinycarousel",
    "tsort" : "tinysort_1.3.27.min",
    "underscore" : "underscore",
    "UserAddressSelector" : "component/UserAddressSelector/UserAddressSelector",
    "Validate" : "util/Validate",
    "velocity" : "velocity",
    "zero-clipboard" : "zero-clipboard/zero-clipboard",

    /* Path Prefixes */
    "ebh" : "../../business/BusinessHomeAction",

    /* Business Home iOS (and miscellaneous) */
    "IphoneBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/ios/iphone/IphoneBusinessHomePresenter",
    "EbhIpadBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/ios/ipad/IpadBusinessHomePresenter",
    "IosHeaderPresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosHeaderPresenter",
    "IosNotebookListPresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosNotebookListPresenter",
    "IosNotebookListElementPresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosNotebookListElementPresenter",
    "IosNotebookDetailPresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosNotebookDetailPresenter",
    "UserNamePresenter" : "../../business/BusinessHomeAction/js/redesign/user/UserNamePresenter",
    "NotebookJoinedBadgePresenter" : "../../business/BusinessHomeAction/js/redesign/notebook/NotebookJoinedBadgePresenter",
    "EbhIpadNotebookDetailLightboxPresenter" :  "../../business/BusinessHomeAction/js/redesign/ios/ipad/IpadNotebookDetailLightboxPresenter",
    "EbhIpadHeaderPresenter" :  "../../business/BusinessHomeAction/js/redesign/ios/ipad/IpadHeaderPresenter",
    "EbhIphoneHeaderPresenter" :  "../../business/BusinessHomeAction/js/redesign/ios/iphone/IphoneHeaderPresenter",
    "EbhIphoneHeaderNotebookListPresenter" :  "../../business/BusinessHomeAction/js/redesign/ios/iphone/IphoneHeaderNotebookListPresenter",
    "EbhIphoneHeaderNotebookDetailPresenter" :  "../../business/BusinessHomeAction/js/redesign/ios/iphone/IphoneHeaderNotebookDetailPresenter",
    "EbhIosBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosBusinessHomePresenter",
    "EbhNotebookListEmptyStateItemPresenter" : "../../business/BusinessHomeAction/js/redesign/ios/IosNotebookListEmptyStateItemPresenter",

    /* Business Home Android */
    "EbhAndroidBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidBusinessHomePresenter",
    "EbhAndroidNotebookDetailPresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidNotebookDetailPresenter",
    "EbhAndroidNotebookListViewPresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidNotebookListViewPresenter",
    "EbhAndroidNotebookListItemsPresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidNotebookListItemsPresenter",
    "EbhAndroidNotebookListItemPresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidNotebookListItemPresenter",
    "EbhAndroidNotebookListEmptyPresenter" : "../../business/BusinessHomeAction/js/redesign/android/AndroidNotebookListEmptyPresenter",
    "EbhAndroidPhoneBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/android/phone/AndroidPhoneBusinessHomePresenter",
    "EbhAndroidPhoneNotebookDetailViewPresenter" : "../../business/BusinessHomeAction/js/redesign/android/phone/AndroidPhoneNotebookDetailViewPresenter",
    "EbhAndroidTabletBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/android/tablet/AndroidTabletBusinessHomePresenter",
    "EbhAndroidTabletNotebookDetailLightboxPresenter" : "../../business/BusinessHomeAction/js/redesign/android/tablet/AndroidTabletNotebookDetailLightboxPresenter",

    /* Business Home Webclient */
    "EbhWebclientBusinessHomePresenter" : "../../business/BusinessHomeAction/js/redesign/webclient/WebclientBusinessHomePresenter",
    "EbhWebclientNotebookListItemsPresenter" : "../../business/BusinessHomeAction/js/redesign/webclient/WebclientNotebookListItemsPresenter",
    "EbhWebclientNotebookListItemPresenter" : "../../business/BusinessHomeAction/js/redesign/webclient/WebclientNotebookListItemPresenter",
    "EbhWebclientNotebookListItemPlaceholderPresenter" : "../../business/BusinessHomeAction/js/redesign/webclient/WebclientNotebookListItemPlaceholderPresenter",
    "EbhWebclientNotebookListEmptyPresenter" : "../../business/BusinessHomeAction/js/redesign/webclient/WebclientNotebookListEmptyPresenter",

    /* Core Business Home JS */
    "EbhData" : "../../business/BusinessHomeAction/js/BusinessHome.EbhData",
    "EbhEventManager" : "../../business/BusinessHomeAction/js/BusinessHome.EbhEventManager",
    "EbhLinkedNotebook" : "../../business/BusinessHomeAction/js/BusinessHome.LinkedNotebook",
    "EbhListLazyLoader" : "../../business/BusinessHomeAction/js/BusinessHome.ListLazyLoader",
    "EbhNote" : "../../business/BusinessHomeAction/js/BusinessHome.Note",
    "EbhNotebook" : "../../business/BusinessHomeAction/js/BusinessHome.Notebook",
    "EbhPluralizer" : "../../business/BusinessHomeAction/js/BusinessHome.Pluralizer",
    "EbhSharedNotebook" : "../../business/BusinessHomeAction/js/BusinessHome.SharedNotebook",
    "EbhScrollLoader" : "../../business/BusinessHomeAction/js/BusinessHome.ScrollLoader",
    "EbhTenaciousRequest" : "../../business/BusinessHomeAction/js/BusinessHome.TenaciousRequest",
    "EbhUser" : "../../business/BusinessHomeAction/js/BusinessHome.User",
    "EbhUtil" : "../../business/BusinessHomeAction/js/BusinessHome.Util",

    /* Redesigned Business Home Framework */
    "EbhAbstractPresenter" : "../../business/BusinessHomeAction/js/redesign/EbhAbstractPresenter",
    "EbhMinimalUserPresenter" : "../../business/BusinessHomeAction/js/redesign/MinimalUserPresenter",
    "EbhModel" : "../../business/BusinessHomeAction/js/framework/Model",
    "EbhNotebookTestPresenter" : "../../business/BusinessHomeAction/js/redesign/NotebookTestPresenter",
    "EbhPresenter" : "../../business/BusinessHomeAction/js/framework/Presenter",
    "EbhRedesignNotebookPresenter" : "../../business/BusinessHomeAction/js/redesign/NotebookPresenter",
    "EbhRedesignUserPresenter" : "../../business/BusinessHomeAction/js/redesign/UserPresenter",

    /* Business Home Desktop */
    "EbhSearchPresenter" : "../../business/BusinessHomeAction/js/BusinessHome.SearchPresenter",
    "EbhNotebookPresenter" : "../../business/BusinessHomeAction/js/BusinessHome.NotebookPresenter",
    "EbhUserPresenter" : "../../business/BusinessHomeAction/js/BusinessHome.UserPresenter",
    "EbhNotePreviewManager" : "../../business/BusinessHomeAction/js/BusinessHome.NotePreviewManager",
    "EbhSortManager" : "../../business/BusinessHomeAction/js/BusinessHome.SortManager",
    "EbhTourPresenter" : "../../business/BusinessHomeAction/js/BusinessHome.TourPresenter",
    "EbhInviteToBusinessManager" : "../../business/BusinessHomeAction/js/BusinessHome.InviteToBusinessManager",
    "EbhToastManager" : "../../business/BusinessHomeAction/js/BusinessHome.ToastManager",
    "EbhContinueSetupPresenter" : "../../business/BusinessHomeAction/js/redesign/continueSetup/ContinueSetupPresenter",

    /* Business Summary */
    "EbhAbstractCardPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/AbstractCardPresenter",
    "EbhActiveUserPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/ActiveUserPresenter",
    "EbhAdditionalActiveUsersPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/AdditionalActiveUsersPresenter",
    "EbhBizSumNotebookNamePresenter" : "../../business/BusinessHomeAction/js/redesign/summary/NotebookNamePresenter",
    "EbhBizSumUserNamePresenter" : "../../business/BusinessHomeAction/js/redesign/summary/SummaryUserNamePresenter",
    "EbhBusinessSummaryAnalytics" : "../../business/BusinessHomeAction/js/redesign/summary/Analytics",
    "EbhBusinessSummaryModel" : "../../business/BusinessHomeAction/js/redesign/summary/models/BusinessSummaryModel",
    "EbhBusinessSummaryPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/BusinessSummaryPresenter",
    "EbhBusinessSummaryHeaderPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/BusinessSummaryHeaderPresenter",
    "EbhCardGridPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/CardGridPresenter",
    "EbhEducationCardPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/EducationCardPresenter",
    "EbhNewUserListPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/NewUserListPresenter",
    "EbhNewUserListEmptyStatePresenter" : "../../business/BusinessHomeAction/js/redesign/summary/NewUserListEmptyStatePresenter",
    "EbhNewUserListElementPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/NewUserListElementPresenter",
    "EbhNoteCardPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/NoteCardPresenter",
    "EbhRecommendedNote" : "../../business/BusinessHomeAction/js/redesign/summary/models/RecommendedNote",
    "EbhRecommendedNotebook" : "../../business/BusinessHomeAction/js/redesign/summary/models/RecommendedNotebook",
    "EbhRecommendedNotebookListPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/RecommendedNotebookListPresenter",
    "EbhRecommendedNotebookListElementPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/RecommendedNotebookListElementPresenter",
    "EbhRelatedContentCardPresenter" : "../../business/BusinessHomeAction/js/redesign/summary/RelatedContentCardPresenter",

    "BusinessCheckoutSingleCountry" : "../../modules/BusinessCheckoutSingleCountry/BusinessCheckoutSingleCountry",
    "BusinessCheckoutReseller" : "../../modules/BusinessCheckoutReseller/BusinessCheckoutReseller",
    "BusinessCheckoutMultiCountry" : "../../modules/BusinessCheckoutMultiCountry/BusinessCheckoutMultiCountry",
    "BusinessCheckoutFreeMultiCountry" : "../../business/BusinessCheckoutAction/FreeTrialMultiCountry",
    "BusinessCheckoutPromotionMultiCountry" : "../../business/BusinessCheckoutAction/PromotionMultiCountry",
    "BusinessCheckoutForm" : "../../business/BusinessCheckoutAction/BusinessCheckoutForm",
    "BusinessCheckoutActionSingleform" : "../../business/BusinessCheckoutAction/Singleform",

    /* ENIM */
    "Enim" : "enim/Enim",
    "EnimClient" : "enim/EnimClient",
    "EnimMessage" : "enim/EnimMessage",
    "EnimObject" : "enim/EnimObject",
    "EnimThread" : "enim/EnimThread",

    /* JS Thrift client configuration */
    "thrift" : "thrift/Thrift",
    "BusinessServiceClient" : "thrift/client/BusinessServiceClient",
    "ENThriftClient" : "thrift/client/ENThriftClient",
    "NoteStoreClient" : "thrift/client/NoteStoreClient",
    "UserStoreClient" : "thrift/client/UserStoreClient",
    "UtilityStoreClient" : "thrift/client/UtilityStoreClient",
    "RealTimeMessageService" : "thrift/client/RealTimeMessageService",
    "MessageStoreClient" : "thrift/client/MessageStoreClient",
    "Errors" : "thrift/gen-js/Errors",
    "Limits" : "thrift/gen-js/Limits",
    "Types" : "thrift/gen-js/Types",
    "BusinessService" : "thrift/gen-js/BusinessService",
    "NoteStore" : "thrift/gen-js/NoteStore",
    "UserStore" : "thrift/gen-js/UserStore",
    "Utility" : "thrift/gen-js/Utility",
    "MessageStore" : "thrift/gen-js/MessageStore",
    "MemBuffer" : "thrift/transport/MemBuffer",
    "StringBuffer" : "thrift/transport/StringBuffer",
    "TBinaryProtocol" : "thrift/protocol/TBinaryProtocol",
    "TJSONProtocol" : "thrift/protocol/TJSONProtocol",
    "TBinaryXmlHttpTransport" : "thrift/transport/TBinaryXmlHttpTransport",
    "TXmlHttpTransport" : "thrift/transport/TXmlHttpTransport",
    "ArrayBufferSerializerTransport" : "thrift/transport/ArrayBufferSerializerTransport",

    /* JavaScript-based in-house component prefixes */
    "ProgressTracker" : "component/ProgressTracker/ProgressTracker",
    "enforceAuthentication" : "component/EnforceAuthentication",
    "fapiaoInput" : "component/FapiaoInput",
    "internalTestingWarning" : "component/InternalTestingWarning",
    "marketCartSummary" : "component/MarketCartSummary",
    "paymentMethod" : "component/PaymentMethodSelector",
    "seriousConfirmation" : "component/SeriousConfirmation",
    "userAddress" : "component/UserAddressSelector",

    /* Manage Note Sharing */
    "ManageNoteSharing": "../../business/ManageNoteSharingAction", // path prefix
    "ManageNoteSharingApp" : "../../business/ManageNoteSharingAction/ManageNoteSharingApp",
    "ManageNoteSharingCancelConfirmDialog" : "../../business/ManageNoteSharingAction/ManageNoteSharingCancelConfirmDialog",
    "ManageNoteSharingCheckbox" : "../../business/ManageNoteSharingAction/ManageNoteSharingCheckbox",
    "ManageNoteSharingConfirmStopSharingLightbox" : "../../business/ManageNoteSharingAction/ManageNoteSharingConfirmStopSharingLightbox",
    "ManageNoteSharingDropDownMenu" : "../../business/ManageNoteSharingAction/ManageNoteSharingDropDownMenu",
    "ManageNoteSharingHeader" : "../../business/ManageNoteSharingAction/ManageNoteSharingHeader",
    "ManageNoteSharingModel" : "../../business/ManageNoteSharingAction/ManageNoteSharingModel",
    "ManageNoteSharingNoteRow" : "../../business/ManageNoteSharingAction/ManageNoteSharingNoteRow",
    "ManageNoteSharingNotesList" : "../../business/ManageNoteSharingAction/ManageNoteSharingNotesList",
    "ManageNoteSharingNoteShareRelationships": "../../business/ManageNoteSharingAction/ManageNoteSharingNoteShareRelationships",
    "ManageNoteSharingPage" : "../../business/ManageNoteSharingAction/ManageNoteSharingPage",
    "ManageNoteSharingRecipient" : "../../business/ManageNoteSharingAction/ManageNoteSharingRecipient",
    "ManageNoteSharingRecipientList" : "../../business/ManageNoteSharingAction/ManageNoteSharingRecipientList",
    "ManageNoteSharingSearchFilters" : "../../business/ManageNoteSharingAction/ManageNoteSharingSearchFilters",
    "ManageNoteSharingUnrecoverableErrorDialog" : "../../business/ManageNoteSharingAction/ManageNoteSharingUnrecoverableErrorDialog",

    /* Market */
    "MarketCommon" : "market/MarketCommon",
    "MarketDispatcher" : "market/flux/dispatcher/MarketDispatcher",
    "MarketConstants" : "market/flux/constants/MarketConstants",
    "MarketUtils" : "market/flux/utils/MarketUtils",

    "MarketClickListener"  : "market/analytics/ClickListener",
    "MarketTrackingInfo"   : "market/analytics/TrackingInfo",

    "AddToCartButtonStore" : "market/flux/stores/AddToCartButtonStore",
    "CatalogStore" : "market/flux/stores/CatalogStore",
    "SelectedVariantStore" : "market/flux/stores/SelectedVariantStore",
    "StringStore" : "market/flux/stores/StringStore",
    "VariantQuantityStore" : "market/flux/stores/VariantQuantityStore",
    "VariantSelectorStore" : "market/flux/stores/VariantSelectorStore",
    "CartStore"            : "market/flux/stores/CartStore",
    'FormSubmitRouterStore': "market/flux/stores/FormSubmitRouterStore",
    "ExperimentStore"      : "market/flux/stores/ExperimentStore",

    "CatalogActions" : "market/flux/actions/CatalogActions",
    "VariantSelectorActions" : "market/flux/actions/VariantSelectorActions",
    "StringActions" : "market/flux/actions/StringActions",
    "CartActions": "market/flux/actions/CartActions",
    "FormSubmitRouterActions": "market/flux/actions/FormSubmitRouterActions",
    "ExperimentActions": "market/flux/actions/ExperimentActions",

    "ScrollHandler"         : "market/flux/mixins/ScrollHandlerMixin",

    "ReactVariantSelector" : "market/flux/components/VariantSelector.react",
    "ReactAddToCartButton" : "market/flux/components/AddToCartButton.react",
    "ReactAddToCartForm" : "market/flux/components/AddToCartForm.react",
    "ReactPriceDisplay" : "market/flux/components/PriceDisplay.react",
    "ReactVariantQuantitySelector" : "market/flux/components/VariantQuantitySelector.react",
    "ReactVariantStatus" : "market/flux/components/VariantStatus.react",
    "ReactCatalogRouter" : "market/flux/components/CatalogRouter.react",
    "ReactMarketCatalog" : "market/flux/components/MarketCatalog.react",
    "ReactCatalogNav" : "market/flux/components/CatalogNav.react",
    "ReactProductImpressionsWindow" : "market/flux/components/ProductImpressionsWindow.react",
    "ReactProductList": "market/flux/components/ProductList.react",
    "ReactProductListItem": "market/flux/components/ProductListItem.react",
    "ReactMarketModal":  "market/flux/components/MarketModal.react",
    "ReactFormSubmitRouter": "market/flux/routers/FormSubmitRouter.react",
    "VariantSelectorRoute": "market/flux/routes/VariantSelectorRoute.react",
    "CartRoute": "market/flux/routes/CartRoute.react",
    "ReactHeaderCTAButton" : "market/flux/components/HeaderCTAButton.react",

    "VariantSelector": "market/flux/VariantSelector",

    "notouch" : "market/notouch",
    "EM_Api" : "market/api",
    "EM_App": "market/App",
    "EM_Hero" : "market/ProductHero",
    "EM_Image" : "market/responsiveImage",
    "EM_ImageViewer" : "market/ImageViewer",
    "EM_Link" : "market/smartLink",
    "EM_MustacheImageFilter" : "market/mustacheVariantImageFilter",
    "EM_OtherProducts": "market/otherProducts",
    "EM_OverflowGrid" : "market/overflowGrid",
    "EM_PremiumBadge" : "market/PremiumBadge",
    "EM_ProductInfo" : "market/ProductInfo",
    "EM_Responsive" : "market/responsiveLayout",
    "EM_Social" : "market/Social",
    "EM_VariantDisplayName" : "market/variantDisplayName",
    "EM_Youku" : "market/youku",
    "EM_Youtube" : "market/video",
    "EM_BasicExperiment": "market/BasicExperiment",
    "EM_VariantSelector": "market/EM_VariantSelector",
    "EM_BackToTopExperiments": "market/BackToTopExperiments",
    "lastDayToShip" : "market/lastDayToShip",
    "cxApi_Loader": "market/cxApiLoader",
    "EM_TimeTracking": "market/TimeTracking",
    "EM_Utils": "market/utils",

    /* Manage Notebooks */
    "ManageNotebooksAdmin" : "../../business/ManageNotebooksAction/NotebooksAdmin",
    "ManageNotebooksPresenter" : "../../business/ManageNotebooksAction/NotebookPresenter",

    /* Multitier checkout (subscriptions page) */
    "AppStoreType" : "../../MultitierCheckoutAction/js/AppStoreType",
    "MultitierCheckoutApp" : "../../MultitierCheckoutAction/js/MultitierCheckoutApp",
    "TierExperimentVariables" : "../../MultitierCheckoutAction/js/TierExperimentVariables",
    "TierSelectionTracker" : "../../MultitierCheckoutAction/js/TierSelectionTracker",
    "TierSelectionComponent" : "../../MultitierCheckoutAction/js/TierSelectionComponent",
    "BasicTierComponent" : "../../MultitierCheckoutAction/js/BasicTierComponent",
    "CheckoutComponent" : "../../MultitierCheckoutAction/js/CheckoutComponent",
    "CheckoutInfoPane" : "../../MultitierCheckoutAction/js/CheckoutInfoPane",
    "BusinessPackageDescriptionComponent" : "component/BusinessPackageDescription/BusinessPackageDescriptionComponent",
    "ReceiptComponent" : "component/ReceiptComponent/ReceiptComponent",
    "SimpleTierConfirmComponent" : "component/SimpleTierConfirmComponent/SimpleTierConfirmComponent",
    "TierConfirmComponent" : "component/TierConfirmComponent/TierConfirmComponent",
    "CancelVendorBadComponent" : "component/CancelVendorBadComponent/CancelVendorBadComponent",
    "GenericConfirmation" : "component/GenericConfirmation/GenericConfirmation",

    "MultitierActivateApp" : "../../MultitierActivateAction/MultitierActivateApp",
    "MultitierCancelConfirmApp" : "../../MultitierCancelConfirmAction/MultitierCancelConfirmApp",
    "MultitierStyleSkin" : "util/MultitierStyleSkin",
    "MultitierAfterConfirmHandler" : "util/MultitierAfterConfirmHandler"
  },
  /*
   * Legacy libraries that have dependencies but don't define them through
   * require go here
   */
  shim : {
    "billing" : [ 'jquery' ],
    "checkout" : [ 'jquery' ],
    "collapse" : [ 'jquery' ],
    "customize-sponsor" : [ 'jquery' ],
    "dataTableRequest" : [ 'jquery' ],
    "dataTableResponse" : [ 'jquery' ],
    "decrypt" : {
      exports: "ENCrypt",
      init: function() {
        return this.ENCrypt;
      }
    },
    "flash-detect" : {
      exports: "FlashDetect",
      init : function() {
        return this.FlashDetect;
      }
    },
    "jquery-autoresize" : [ 'jquery' ],
    "jquery-ui" : [ 'jquery' ],
    "jquery-form" : [ 'jquery' ],
    "jquery-serializeObject" : [ 'jquery' ],
    "jqueryENDatatables" : [ 'jquery', 'dataTableRequest',
        'dataTableResponse' ],
    "jsonrpc" : [ 'json2' ],
    "password-strength" : [ 'jquery' ],
    "react" : [ 'es6' ],
    "react-infinite" : [ 'react' ],
    "sponsorCheckout" : [ 'jquery' ],
    "sponsor-uri-check" : [ 'jquery' ],
    "textext" : ['jquery', 'json2'],
    "tinycarousel" : [ 'jquery' ],
    "tsort" : [ 'jquery' ],

    "zero-clipboard" : {
      exports : "ZeroClipboard",
      init: function() {
        this.ZeroClipboard
            .setMoviePath("/redesign/global/js/zeroClipboard/ZeroClipboard.swf");
        return this.ZeroClipboard;
      }
    }
  },
  waitSeconds : 60
  // domReady sometimes times out if page load is exceptionally long (e.g. in
  // the webclient).
});

/*
 * We set up the getConfig function if we were running in nodejs. Export the config
 * object, and clean up the properties we defined on require.
 */
if (typeof require.getConfig === "function") {
  module.exports = require.getConfig();
  require.getConfig = undefined;
  require.config = undefined;
}

/* Define reference to Evernote object for legacy libraries. */
var Evernote;

if (!Evernote) {
  Evernote = {};
}
