/*============================================================================
  (c) Copyright 2014 Shopify Inc. Author: Carson Shold (@cshold). All Rights Reserved.

  Plugin Documentation - http://shopify.github.io/Timber/#ajax-cart

  Ajaxify the add to cart experience and flip the button for inline confirmation,
  show the cart in a modal, or a 3D drawer.

  This file includes:
    - Basic Shopify Ajax API calls
    - Ajaxify cart plugin

  This requires:
    - jQuery 1.8+
    - handlebars.min.js (for cart template)
    - modernizer.min.js
    - snippet/ajax-cart-template.liquid

  JQUERY API (c) Copyright 2009-2014 Shopify Inc. Author: Caroline Schnapp. All Rights Reserved.
  Includes slight modifications to addItemFromForm.

  Slightly Customized version of the plugin to incorporate a right drawer cart
==============================================================================*/
if ((typeof Shopify) === 'undefined') { Shopify = {}; }

/*============================================================================
  Basic JS Helper FUnctions
==============================================================================*/
function urlParams (name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

/*============================================================================
  API Helper Functions
==============================================================================*/
function floatToString(numeric, decimals) {
  var amount = numeric.toFixed(decimals).toString();
  if(amount.match(/^\.\d+/)) {return "0"+amount; }
  else { return amount; }
}

function attributeToString(attribute) {
  if ((typeof attribute) !== 'string') {
    attribute += '';
    if (attribute === 'undefined') {
      attribute = '';
    }
  }
  return jQuery.trim(attribute);
}

function getCookie(c_name) {
  var c_value = document.cookie;
  var c_start = c_value.indexOf(" " + c_name + "=");
  if (c_start == -1) {
    c_start = c_value.indexOf(c_name + "=");
  }
  if (c_start == -1) {
    c_value = null;
  }
  else {
    c_start = c_value.indexOf("=", c_start) + 1;
    var c_end = c_value.indexOf(";", c_start);
    if (c_end == -1) {
      c_end = c_value.length;
    }
    c_value = unescape(c_value.substring(c_start,c_end));
  }
  return c_value;
}

/*============================================================================
  API Functions
==============================================================================*/
Shopify.formatMoney = function(cents, format) {

  if (typeof cents == 'string') cents = cents.replace('.','');
  var value = '';
  var patt = /\{\{\s*(\w+)\s*\}\}/;
  var formatString = (format || this.money_format);

  function addCommas(moneyString) {
    return moneyString.replace(/(\d+)(\d{3}[\.,]?)/,'$1,$2');
  }

  switch(formatString.match(patt)[1]) {
    case 'amount':
      value = addCommas(floatToString(cents/100.0, 2));
      break;
    case 'amount_no_decimals':
      value = addCommas(floatToString(cents/100.0, 0));
      break;
    case 'amount_with_comma_separator':
      value = floatToString(cents/100.0, 2).replace(/\./, ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = addCommas(floatToString(cents/100.0, 0)).replace(/\./, ',');
      break;
  }
  return formatString.replace(patt, value);
};

Shopify.onProduct = function(product) {
  // alert('Received everything we ever wanted to know about ' + product.title);
};

Shopify.onCartUpdate = function(cart) {
  // alert('There are now ' + cart.item_count + ' items in the cart.');
};

Shopify.updateCartNote = function(note, callback) {
  var params = {
    type: 'POST',
    url: '/cart/update.js',
    data: 'note=' + attributeToString(note),
    dataType: 'json',
    success: function(cart) {
      if ((typeof callback) === 'function') {
        callback(cart);
      }
      else {
        Shopify.onCartUpdate(cart);
      }
    },
    error: function(XMLHttpRequest, textStatus) {
      Shopify.onError(XMLHttpRequest, textStatus);
    }
  };
  jQuery.ajax(params);
};

Shopify.onError = function(XMLHttpRequest, textStatus) {
  var data = eval('(' + XMLHttpRequest.responseText + ')');
  if (!!data.message) {
    alert(data.message + '(' + data.status  + '): ' + data.description);
  } else {
    alert('Error : ' + Shopify.fullMessagesFromErrors(data).join('; ') + '.');
  }
};

/*============================================================================
  POST to cart/add.js returns the JSON of the line item associated with the added item
==============================================================================*/
Shopify.addItem = function(variant_id, quantity, callback) {
  quantity = quantity || 1;
  var params = {
    type: 'POST',
    url: '/cart/add.js',
    data: 'quantity=' + quantity + '&id=' + variant_id,
    dataType: 'json',
    success: function(line_item) {
      if ((typeof callback) === 'function') {
        callback(line_item);
      }
      else {
        Shopify.onItemAdded(line_item);
      }
    },
    error: function(XMLHttpRequest, textStatus) {
      Shopify.onError(XMLHttpRequest, textStatus);
    }
  };
  jQuery.ajax(params);
};

/*============================================================================
  POST to cart/add.js returns the JSON of the line item
    - Allow use of form element instead of id
    - Allow custom error callback
==============================================================================*/
Shopify.addItemFromForm = function(form, callback, errorCallback) {
  var params = {
    type: 'POST',
    url: '/cart/add.js',
    data: jQuery(form).serialize(),
    dataType: 'json',
    success: function(line_item) {
      if ((typeof callback) === 'function') {
        callback(line_item, form);
      }
      else {
        Shopify.onItemAdded(line_item, form);
      }
    },
    error: function(XMLHttpRequest, textStatus) {
      if ((typeof errorCallback) === 'function') {
        errorCallback(XMLHttpRequest, textStatus);
      }
      else {
        Shopify.onError(XMLHttpRequest, textStatus);
      }
    }
  };
  jQuery.ajax(params);
};

// Get from cart.js returns the cart in JSON
Shopify.getCart = function(callback) {
  jQuery.getJSON('/cart.js', function (cart, textStatus) {
    if ((typeof callback) === 'function') {
      callback(cart);
    }
    else {
      Shopify.onCartUpdate(cart);
    }
    removeLineItem();
  });
};

// GET products/<product-handle>.js returns the product in JSON
Shopify.getProduct = function(handle, callback) {
  jQuery.getJSON('/products/' + handle + '.js', function (product, textStatus) {
    if ((typeof callback) === 'function') {
      callback(product);
    }
    else {
      Shopify.onProduct(product);
    }
  });
};

// POST to cart/change.js returns the cart in JSON
Shopify.changeItem = function(line, quantity, callback) {
  var params = {
    type: 'POST',
    url: '/cart/change.js',
    data:  'quantity=' + quantity + '&line=' + line,
    dataType: 'json',
    success: function(cart) {
      if ((typeof callback) === 'function') {
        callback(cart);
      }
      else {
        Shopify.onCartUpdate(cart);
      }
    },
    error: function(XMLHttpRequest, textStatus) {
      Shopify.onError(XMLHttpRequest, textStatus);
    }
  };
  jQuery.ajax(params);
};

/*============================================================================
  Ajaxify Shopify Add To Cart
==============================================================================*/
var ajaxifyShopify = (function(module, $) {
  'use strict';

  // Public functions
  var init;

  // Private general variables
  var settings, cartInit, $cssTransforms, $cssTransforms3d, $nojQueryLoad, $window, $body, $html, $pageWrapper, $wrapperClass;

  // Private plugin variables
  var $formContainer, $btnClass, $windowrapperClass, $addToCart, $flipClose, $flipCart, $flipContainer, $cartCountSelector, $cartCostSelector, $drawerSelector, $toggleCartButton, $modal, $cartContainer, $modalContainer, $modalOverlay, $closeCart, $drawerContainer, $prependDrawerTo, $callbackData={}, $removeClass;

  // Private functions
  var updateCountPrice, flipSetup, revertFlipButton, modalSetup, showModal, sizeModal, hideModal, drawerSetup, showDrawer, hideDrawer, loadCartImages, formOverride, itemAddedCallback, itemErrorCallback, cartUpdateCallback, setToggleButtons, flipCartUpdateCallback, buildCart, cartTemplate, adjustCart, adjustCartCallback, createQtySelectors, qtySelectors, validateQty, scrollTop, toggleCallback, removeLineItem;

  /*============================================================================
    Initialise the plugin and define global options
  ==============================================================================*/
  init = function (options) {

    // Default settings
    settings = {
      method: 'drawer', // Method options are drawer, modal, and flip. Default is drawer.
      formSelector: 'form[action^="/cart/add"]',
      addToCartSelector: 'button[type="submit"]',
      cartCountSelector: null,
      cartCostSelector: null,
      drawerSelector: '#ajaxifyDrawer',
      toggleCartButton: null,
      btnClass: null,
      wrapperClass: null,
      useCartTemplate: false,
      moneyFormat: '$',
      disableAjaxCart: false,
      enableQtySelectors: true,
      prependDrawerTo: '#quickcart_div',
      onToggleCallback: null,
      drawerExists: false,
      removeClass: '.item_remove'
    };
    

    // Override defaults with arguments
    $.extend(settings, options);

    // If method parameter is set, override the defined method (used for demos)
    if ( urlParams('method') ) {
      settings.method = urlParams('method');
    }

    // Make sure method is lower case
    settings.method = settings.method.toLowerCase();

    // Select DOM elements
    $formContainer     = $(settings.formSelector);
    $btnClass          = settings.btnClass;
    $wrapperClass      = settings.wrapperClass;
    $addToCart         = $formContainer.find(settings.addToCartSelector);
    $flipContainer     = null;
    $flipClose         = null;
    $cartCountSelector = $(settings.cartCountSelector);
    $cartCostSelector  = $(settings.cartCostSelector);
    $drawerSelector    = $(settings.drawerSelector);
    $toggleCartButton  = $(settings.toggleCartButton);
    $modal             = null;
    $prependDrawerTo   = $(settings.prependDrawerTo);
    $removeClass	   = $(settings.removeClass);

    // CSS Checks
    $cssTransforms   = Modernizr.csstransforms;
    $cssTransforms3d = Modernizr.csstransforms3d;

    // General Selectors
    $window      = $(window);
    $body        = $('body');
    $html        = $('html');
    $pageWrapper = $('.page-element');

    // Check if we can use .load
    $nojQueryLoad = $html.hasClass('lt-ie9');
    if ($nojQueryLoad) {
      settings.useCartTemplate = false;
    }
    
    // Check if the drawer is already set up
    if ($drawerSelector.length) {
      settings.drawerExists = true;
    }

    // Setup ajax quantity selectors on the any template if enableQtySelectors is true
    if (settings.enableQtySelectors) {
      qtySelectors();
    }

    // Enable the ajax cart
    if (!settings.disableAjaxCart) {
      // Handle each case add to cart method
      switch (settings.method) {
        case 'flip':
          flipSetup();
          break;

        case 'modal':
          modalSetup();
          break;

        case 'drawer':
          drawerSetup();
          break;
      }
      
      // Escape key closes cart
      $(document).keyup( function (evt) {
        if (evt.keyCode == 27) {
          switch (settings.method) {
            case 'flip':
            case 'drawer':
              hideDrawer();
              break;
            case 'modal':
              hideModal();
              break;
          }
        }
      });
      
      if ( $addToCart.length ) {
        // Take over the add to cart form submit
        formOverride();
      }
    }

    // Run this function in case we're using the quantity selector outside of the cart
    adjustCart();
  };

  updateCountPrice = function (cart) {
    if ($cartCountSelector) {
      $cartCountSelector.html(cart.item_count).removeClass('hidden-count');

//       if (cart.item_count === 0) {
//         $cartCountSelector.addClass('hidden-count');
//       }
    }
    if ($cartCostSelector) {
      $cartCostSelector.html(Shopify.formatMoney(cart.total_price, settings.moneyFormat));
    }
  };

  flipSetup = function () {
    // Build and append the drawer in the DOM
    drawerSetup();

    // Stop if there is no add to cart button
    if ( !$addToCart.length ) {
      return;
    }

    // Wrap the add to cart button in a div
    $addToCart.addClass('flip-front').wrap('<div class="flip"></div>');

    // Write a (hidden) Checkout button, a loader, and the extra view cart button
    var checkoutBtn = $('<a href="/cart" class="flip-back" style="background-color: #C00; color: #fff;" id="flip-checkout">Checkout</a>').addClass($btnClass),
        flipLoader = $('<span class="ajaxifyCart-loader"></span>'),
        flipExtra = $('<div class="flip-extra"><a href="#" class="flip-cart">View Cart (<span></span>)</a></div>');

    // Append checkout button and loader
    checkoutBtn.insertAfter($addToCart);
    flipLoader.insertAfter(checkoutBtn);

    // Setup new selectors
    $flipContainer = $('.flip');

    if (!$cssTransforms3d) {
      $flipContainer.addClass('no-transforms');
    }

    // Setup extra selectors once appended
    flipExtra.insertAfter($flipContainer);
    $flipCart = $('.flip-cart');

    $flipCart.on('click', function(e) {
      e.preventDefault();
      showDrawer(true);
    });

    // Reset the button if a user changes a variation
    $('input[type="checkbox"], input[type="radio"], select', $formContainer).on('click', function() {
      revertFlipButton();
    });
  };

  revertFlipButton = function () {
    $flipContainer.removeClass('is-flipped');
  };

  modalSetup = function () {
    // Create modal DOM elements with handlebars.js template
    var source   = $("#modalTemplate").html(),
        template = Handlebars.compile(source);

    // Append modal and overlay to body
    $body.append(template).append('<div id="ajaxifyCart-overlay"></div>');

    // Modal selectors
    $modalContainer = $('#ajaxifyModal');
    $modalOverlay   = $('#ajaxifyCart-overlay');
    $cartContainer  = $('#ajaxifyCart');

    // Close modal when clicking the overlay
    $modalOverlay.on('click', hideModal);

    // Create a close modal button
    $modalContainer.prepend('<a class="ajaxifyCart--close" title="Close Cart"><span class="icon-fallback-text"><span class="icon icon-cross" aria-hidden="true"></span><span class="fallback-text">translation missing: en.general.navigation.close</span></span></a>');
    $closeCart = $('.ajaxifyCart--close');
    $closeCart.on('click', hideModal);

    // Add a class if CSS translate isn't available
    if (!$cssTransforms) {
      $modalContainer.addClass('no-transforms');
    }

    // Update modal position on screen changes
    $(window).on({
      orientationchange: function(e) {
        if ($modalContainer.hasClass('is-visible')) {
          sizeModal('resize');
        }
      }, resize: function(e) {
        // IE8 fires this when overflow on body is changed. Ignore IE8.
        if (!$nojQueryLoad && $modalContainer.hasClass('is-visible')) {
          sizeModal('resize');
        }
      }
    });

    // Toggle modal with cart button
    setToggleButtons();
  };

  showModal = function (toggle) {
    $body.addClass('ajaxify-modal--visible');
    // Build the cart if it isn't already there
    if ( !cartInit && toggle ) {
      Shopify.getCart(cartUpdateCallback);
    } else {
      sizeModal();
    }
  };

  sizeModal = function(isResizing) {
    if (!isResizing) {
      $modalContainer.css('opacity', 0);
    }

    // Position modal by negative margin
    $modalContainer.css({
      'margin-left': - ($modalContainer.outerWidth() / 2),
      'opacity': 1
    });

    // Position close button relative to title
    $closeCart.css({
      'top': 10 + ( $cartContainer.find('h1').height() / 2 )
    });

    setTimeout(function () {
      $modalContainer.addClass('is-visible');
      $(".ajaxifyCart--products").mCustomScrollbar();
    }, 200);
    

    scrollTop();
  };

  hideModal = function (e) {
    $body.removeClass('ajaxify-modal--visible');
    if (e) {
      e.preventDefault();
    }

    if ($modalContainer) {
      $body.removeClass('ajaxify-lock');
    }

    toggleCallback({
      'is_visible': false
    });
  };

  drawerSetup = function () {
    // Create drawer DOM elements with handlebars.js template
    var source   = $("#drawerTemplate").html(),
        template = Handlebars.compile(source),
        data = {
          wrapperClass: $wrapperClass
        };

    // Append drawer (defaults to body)
    if (!settings.drawerExists){
      $prependDrawerTo.prepend(template(data));
      
    }

    // Drawer selectors
    $drawerContainer = $('#ajaxifyDrawer');
    $cartContainer   = $('#ajaxifyCart');

    // Create a close cart button
    if (!$('.ajaxifyCart--close').length) {
      $drawerContainer.prepend('<a class="ajaxifyCart--close close-btn" title="Close"></a>');
    }
    $closeCart = $('.ajaxifyCart--close');
    $closeCart.on('click', hideDrawer);
    
    $('body').on('click', hideDrawer);
    
    
          var windowWidthq = jQuery(window).width();
   if (windowWidthq < 1025){
     
     $('body').on('touchstart', hideDrawer);
     $('#ajaxifyDrawer').on('touchstart', function(e){
      e.stopPropagation();
      showDrawer(true);
    });
      $('li.cart').on('touchstart', function(e){
      e.stopPropagation();
      showDrawer(true);
    });
     
     
         $('.ajaxifyCart--close').on('touchstart', function(e){
      
      
      e.stopPropagation();
      hideDrawer();
      
       $("#ajaxifyDrawer").removeClass('fade-in');
       $("#ajaxifyDrawer").removeClass('is-visible');
    });
    
   }
    // Toggle drawer with cart button
    //setToggleButtons();
    
    
    
    
    /*------ Do not Edit ---*/
    $('#ajaxifyDrawer').click(function(e){
      e.stopPropagation();
      showDrawer(true);
    });
     $('li.cart').click(function(e){
      e.stopPropagation();
      showDrawer(true);
    });
    
    $('.ajaxifyCart--close').click(function(e){
      
      
      e.stopPropagation();
      hideDrawer();
      
       $("#ajaxifyDrawer").removeClass('fade-in');
       $("#ajaxifyDrawer").removeClass('is-visible');
    });
    
    
    if( $('#CartCount').length > 0 )
    {
      $('#CartCount').click(function(e){
        e.preventDefault();
        if( !$drawerContainer.hasClass('is-visible'))
        {
          showDrawer(true);
        }       
      });
    }
  };

  showDrawer = function (toggle) {
    
    $("#ajaxifyDrawer").addClass('fade-in');
   
    // If we're toggling with the flip method, use a special callback
    if (settings.method == 'flip') {
      Shopify.getCart(flipCartUpdateCallback);
    }
    // opening the drawer for the first time
    else if ( !cartInit && toggle) {
      Shopify.getCart(cartUpdateCallback);
    }


    //setTimeout value should reflect CSS animation speeds
    setTimeout(function () {
      $body.addClass('page-move--cart');
      // Show the drawer
      $drawerContainer.addClass('is-visible');
       $("#ajaxifyDrawer").addClass('fade-in');
      $(".ajaxifyCart--products").mCustomScrollbar();
      $html.addClass('page-move--toggled');
      $body.addClass('mobile-drawer--open');
      
      if ($('.ajaxifyCart--products').length > 0) {
        //$(".ajaxifyCart--products").click(function(e) {
         // e.stopPropagation(); 
        //  return false; 
       // });
      }
    }, 500);

    $pageWrapper.on('click.mobileDrawerOpen', function(){
      if(!$body.hasClass('mobile-drawer--open')) {
        return;
      }

      hideDrawer();
    });
  };
  
  hideDrawer = function () {
    $drawerContainer.removeClass('is-visible');    
    $("#ajaxifyDrawer").removeClass('fade-in');
    $html.removeClass('page-move--toggled');
    $body.removeClass('mobile-drawer--open page-move--cart');
    toggleCallback({
      'is_visible': false
    });

    $pageWrapper.off('click.mobileDrawerOpen');
  };
  
  removeLineItem = function(){
    alert(333);
    if($removeClass.length)
    {
      alert(444);
      $removeClass.click(function(){
        var lineId = $(this).data('pid');
    	Shopify.changeItem(lineId, 0);
      });
    }
  };

    loadCartImages = function () {
    // Size cart once all images are loaded
    var cartImages = $('img', $cartContainer),
        count = cartImages.length,
        index = 0;

    cartImages.on('load', function() {
      index++;

      if (index==count) {
        switch (settings.method) {
          case 'modal':
            sizeModal();
            break;
        }
      }
    });
  };

  formOverride = function () {
    $formContainer.submit(function(e) {
      e.preventDefault();
      // Add class to be styled if desired
      $addToCart.removeClass('is-added').addClass('is-adding');

      // Remove any previous quantity errors
      $('.qty-error').remove();

      Shopify.addItemFromForm(e.target, itemAddedCallback, itemErrorCallback);

      // Set the flip button to a loading state
      switch (settings.method) {
        case 'flip':
          $flipContainer.addClass('flip--is-loading');
          break;
      }
    });
  };

  itemAddedCallback = function (product) {
    $addToCart.removeClass('is-adding').addClass('is-added');
    
//     setTimeout(function () {
//       $(".ajaxifyCart--products").mCustomScrollbar();
//     }, 200);

    // Slight delay of flip to mimic a longer load
    switch (settings.method) {
      case 'flip':
        setTimeout(function () {
          $flipContainer.removeClass('flip--is-loading').addClass('is-flipped');
        }, 600);
        break;
    }
    Shopify.getCart(cartUpdateCallback);
  };

  itemErrorCallback = function (XMLHttpRequest, textStatus) {
    switch (settings.method) {
      case 'flip':
        $flipContainer.removeClass('flip--is-loading');
        break;
    }

    var data = eval('(' + XMLHttpRequest.responseText + ')');
    if (!!data.message) {
      if (data.status == 422) {
        $formContainer.after('<div class="errors qty-error">'+ data.description +'</div>');
      }
    }
  };

  cartUpdateCallback = function (cart) {
    // Update quantity and price
    updateCountPrice(cart);

    switch (settings.method) {
      case 'flip':
        $('.flip-cart span').html(cart.item_count);
        break;
      case 'modal':
        buildCart(cart);
        break;
      case 'drawer':
        buildCart(cart);
        if ( !$drawerContainer.hasClass('is-visible') ) {
          showDrawer();
        } else {
          scrollTop();
        }
        break;
    }
      $(".ajaxifyCart--products").mCustomScrollbar();
  };

  setToggleButtons = function () {
    // Reselect the element in case it just loaded
    $toggleCartButton  = $(settings.toggleCartButton);

    if ($toggleCartButton) {
      // Turn it off by default, in case it's initialized twice
      $toggleCartButton.off('click');

      // Toggle the cart, based on the method
      $toggleCartButton.on('click', function(e) {
        e.preventDefault();

        switch (settings.method) {
          case 'modal':
            if ( $modalContainer.hasClass('is-visible') ) {
              hideModal();
            } else {
              showModal(true);
            }
            break;
          case 'drawer':
          case 'flip':
            if ( $drawerContainer.hasClass('is-visible') ) {
              hideDrawer();
            } else {
              showDrawer(true);
            }
            break;
        }

      });

    }
  };

  flipCartUpdateCallback = function (cart) {
    buildCart(cart);
  };

  buildCart = function (cart) {
    // Empty cart if using default layout or not using the .load method to get /cart
    if (!settings.useCartTemplate || cart.item_count === 0) {
      $cartContainer.empty();
    }

    // Show empty cart
    if (cart.item_count === 0) {
      $cartContainer
      .append('<div class="empty-cart"><h2 class="text-center">Your cart</h2><p class="cart--empty-message text-center">Your cart is currently empty.</p></div>');
      switch (settings.method) {
        case 'modal':
          sizeModal('resize');
          break;
        case 'flip':
      }
      return;
    }

    // Use the /cart template, or Handlebars.js layout based on theme settings
    if (settings.useCartTemplate) {
      cartTemplate(cart);
      return;
    }

    // Handlebars.js cart layout
    var items = [],
        item = {},
        data = {};

    var source   = $("#cartTemplate").html(),
        template = Handlebars.compile(source);

    // Add each item to our handlebars.js data
    $.each(cart.items, function(index, cartItem) {

      var itemAdd = cartItem.quantity + 1,
          itemMinus = cartItem.quantity - 1,
          itemQty = cartItem.quantity;

      /* Hack to get product image thumbnail
       *   - Remove file extension, add _small, and re-add extension
       *   - Create server relative link
      */
      if(cartItem.image){
      var prodImg = cartItem.image.replace(/(\.[^.]*)$/, "_small$1").replace('http:', '');
      }
      
      else {
        var prodImg = '//cdn.shopify.com/s/files/1/0025/0983/2304/t/2/assets/noimage.jpg?4451968102096775208';
      }
      var prodName = cartItem.title.replace(/(\-[^-]*)$/, "");
      var prodVariation = cartItem.title.replace(/^[^\-]*/, "").replace(/-/, "");

      // Create item's data object and add to 'items' array
      item = {
        key: cartItem.key,
        line: index + 1, // Shopify uses a 1+ index in the API
        url: cartItem.url,
        img: prodImg,
        name: prodName,
        variation: prodVariation,
        itemAdd: itemAdd,
        itemMinus: itemMinus,
        itemQty: itemQty,
        price: Shopify.formatMoney(cartItem.price, settings.moneyFormat)
      };

      items.push(item);
    });

    // Gather all cart data and add to DOM
    data = {
      items: items,
      totalPrice: Shopify.formatMoney(cart.total_price, settings.moneyFormat),
      btnClass: $btnClass
    };
    $cartContainer.append(template(data));

    // With new elements we need to relink the adjust cart functions
    adjustCart();

    // Setup close modal button and size drawer
    switch (settings.method) {
      case 'modal':
        loadCartImages();
        break;
      case 'flip':
      case 'drawer':
        if (cart.item_count > 0) {
          loadCartImages();
        }
        break;
      default:
        break;
    }

    // Mark the cart as built
    cartInit = true;
  };

  cartTemplate = function (cart) {
    $cartContainer.load('/cart form[action="/cart"]', function() {

      // With new elements we need to relink the adjust cart functions
      adjustCart();

      // Size drawer at this point
      switch (settings.method) {
        case 'modal':
          loadCartImages();
          break;
        case 'flip':
        case 'drawer':
          if (cart.item_count > 0) {
            loadCartImages();
          }
          break;
        default:
          break;
      }

      // Mark the cart as built
      cartInit = true;

      toggleCallback({
        'is_visible': true
      });
    });
  };

  adjustCart = function () {
    // This function runs on load, and when the cart is reprinted

    // Create ajax friendly quantity fields and remove links in the ajax cart
    if (settings.useCartTemplate) {
      createQtySelectors();
    }

    // Update quantify selectors
    var qtyAdjust = $('.ajaxifyCart--qty span');
    
    // Add or remove from the quantity
    qtyAdjust.off('click');
    qtyAdjust.on('click', function() {
      var el = $(this),
          line = el.data('line'),
          key = el.data('id'),
          qtySelector = el.siblings('.ajaxifyCart--num'),
          qty = qtySelector.val() ? parseInt( qtySelector.val().replace(/\D/g, '') ) : 0;
      
      var qty = validateQty(qty);

      // Add or subtract from the current quantity
      if (el.hasClass('ajaxifyCart--add')) {
        qty = qty + 1;
      } else {
        qty = qty - 1;
        if (qty <= 0) qty = 0;
      }

      // If it has a data-line, update the cart.
      // Otherwise, just update the input's number
      if (line) {
        updateQuantity(line, qty);
      } else {
        qtySelector.val(qty);
      }

    });

    // Update quantity based on input on change
    var qtyInput = $('.ajaxifyCart--num');
    qtyInput.off('change');
    qtyInput.on('change', function() {
      var el = $(this),
          line = el.data('line'),
          qty = parseInt( el.val().replace(/\D/g, '') );

      qty = validateQty(qty);

      // If it has a data-line, update the cart
      if (line) {
        updateQuantity(line, qty);
      }
    });

    // Highlight the text when focused
    qtyInput.off('focus');
    qtyInput.on('focus', function() {
      var el = $(this);
      setTimeout(function() {
        el.select();
      }, 50);
    });

    // Completely remove product
    $('.ajaxifyCart--remove').on('click', function(e) {
      var el = $(this),
          line = el.data('line') || null,
          qty = 0;

      // Without a data-line, let the default link action take over
      if (!line) {
        return;
      }

      e.preventDefault();
      updateQuantity(line, qty);
    });

    function updateQuantity(line, qty) {
      var row;
      // Add activity classes when changing cart quantities
      if (!settings.useCartTemplate) {
        row = $('.ajaxifyCart--row[data-line="' + line + '"]').addClass('ajaxifyCart--is-loading');
      } else {
        row = $('.cart__row[data-line="' + line + '"]').addClass('ajaxifyCart--is-loading');
      }

      if ( qty === 0 ) {
        row.addClass('is-removed');
      }

      // Slight delay to make sure removed animation is done
      setTimeout(function() {
        Shopify.changeItem(line, qty, adjustCartCallback);
      }, 250);
    }

    // Save note anytime it's changed
    var noteArea = $('textarea[name="note"]');
    noteArea.off('change');
    noteArea.on('change', function() {
      var newNote = $(this).val();

      // Simply updating the cart note in case they don't click update/checkout
      Shopify.updateCartNote(newNote, function(cart) {});
    });

    if (window.Shopify && Shopify.StorefrontExpressButtons) {
      Shopify.StorefrontExpressButtons.initialize();
    }
  };

  adjustCartCallback = function (cart) {
    // Update quantity and price
    updateCountPrice(cart);

    // Hide the modal or drawer if we're at 0 items
    if ( cart.item_count === 0 ) {
      // Handle each add to cart method
      switch (settings.method) {
        case 'modal':
          break;
        case 'flip':
        case 'drawer':
          hideDrawer();
          break;
      }
    }

    // Reprint cart on short timeout so you don't see the content being removed
    setTimeout(function() {
      Shopify.getCart(buildCart);
    }, 150);
  };

  createQtySelectors = function() {
    // If there is a normal quantity number field in the ajax cart, replace it with our version
    if ($('input[type="number"]', $cartContainer).length) {
      $('input[type="number"]', $cartContainer).each(function() {
        var el = $(this),
            currentQty = parseInt(el.val());

        var itemAdd = currentQty + 1,
            itemMinus = currentQty - 1,
            itemQty = currentQty;

        var source   = $("#ajaxifyQty").html(),
            template = Handlebars.compile(source),
            data = {
              key: el.data('id'),
              line: el.data('line'),
              itemQty: itemQty,
              itemAdd: itemAdd,
              itemMinus: itemMinus
            };

        // Append new quantity selector then remove original
        el.after(template(data)).remove();
      });
    }

    // If there is a regular link to remove an item, add attributes needed to ajaxify it
    if ($('a[href^="/cart/change"]', $cartContainer).length) {
      $('a[href^="/cart/change"]', $cartContainer).each(function() {
        var el = $(this).addClass('ajaxifyCart--remove');
      });
    }
  };

  qtySelectors = function() {
    // Change number inputs to JS ones, similar to ajax cart but without API integration.
    // Make sure to add the existing name and id to the new input element
    var numInputs = $('input[type="number"]');

    // Qty selector has a minimum of 1 on the product page
    // and 0 in the cart (determined on qty click)
    var qtyMin = 0;

    if (numInputs.length) {
      numInputs.each(function() {
        var el = $(this),
            currentQty = parseInt(el.val()),
            inputName = el.attr('name'),
            inputId = el.attr('id');

        var itemAdd = currentQty + 1,
            itemMinus = currentQty - 1,
            itemQty = currentQty;

        var source   = $("#jsQty").html(),
            template = Handlebars.compile(source),
            data = {
              key: el.data('id'),
              itemQty: itemQty,
              itemAdd: itemAdd,
              itemMinus: itemMinus,
              inputName: inputName,
              inputId: inputId
            };

        // Append new quantity selector then remove original
        el.after(template(data)).remove();
      });

      // Setup listeners to add/subtract from the input
      $('.js--qty-adjuster').on('click', function() {
        var el = $(this),
            id = el.data('id'),
            qtySelector = el.siblings('.js--num'),
            qty = parseInt( qtySelector.val().replace(/\D/g, '') );

        var qty = validateQty(qty);

        if ($body.hasClass('template-product')) {
          qtyMin = 1;
        }

        // Add or subtract from the current quantity
        if (el.hasClass('js--add')) {
          qty = qty + 1;
          if (qty > 10) qty = 10;
        } else {
          qty = qty - 1;
          if (qty <= 1) qty = 1;
        }

        // Update the input's number
        qtySelector.val(qty);
      });
    }
  };

  validateQty = function (qty) {
    // Make sure we have a valid integer
    if( (parseFloat(qty) == parseInt(qty)) && !isNaN(qty) ) {
      // We have a number!
    } else {
      // Not a number. Default to 1.
      qty = 1;
    }
    return qty;
  };

  scrollTop = function () {
    if ($body.scrollTop() > 0 || $html.scrollTop() > 0) {
      $('html, body').animate({
        scrollTop: 0
      }, 250, 'swing');
    }
  };

  toggleCallback = function (data) {
    // General data to send
    data.method = settings.method;

    // Run the callback if it's a function
    if (typeof settings.onToggleCallback == 'function') {
      settings.onToggleCallback.call(this, data);
    }
  };

  module = {
    init: init
  };

  return module;


}(ajaxifyShopify || {}, jQuery));
