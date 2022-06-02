function toggleAction(e) { 
   var target = $(e.target);
   $('#action').val(target.attr('id'));
}

function qr(url = null) {
    var content = $("#pasteContent").val()
    if (url != null) {
        content = window.location.origin + '/' + url
    }
    
    $("#qrModal > div > div > div.modal-body").empty()
    
    QrCreator.render({
        text: content,
        radius: 0.5, // 0.0 to 0.5
        ecLevel: 'Q', // L, M, Q, H
        fill: '#536DFE', // foreground color
        background: null, // color or null for transparent
        size: 500 // in pixels
    }, document.querySelector('#qrModal > div > div > div.modal-body'));
    
    $("#qrModal").modal()
}

function qrPaste(e) {
    e.preventDefault();
    qr();
}

function addAnotherPaste() {
    $("#pasteForm").toggle()
}

$(document).ready(function(){
    
    $('.auto-save').savy('load');
    $('#plain_paste').on('click', toggleAction);
    $('#encrypted_paste').on('click', toggleAction);
    $('#qr_paste').on('click', qrPaste);
    $('#add_another_paste').on('click', addAnotherPaste);
    
    $( "#pasteForm" ).submit(function( event ) {
        // var passwordValue = $("#pastePassword").val();
        var langValue = $("#langList").val();
        var pasteData = $("#pasteContent").val();
        var lifetimeValue = $("#lifetimeList").val();
        var encryptPaste = ($("#action").val() == "encrypted_paste") ? true : false;
        
        if (pasteData == "") {
            alert("Empty pastes aren't allowed!");
            event.preventDefault();
            return;
        }
        
        // Post the data. Get the hash from the response and redirect to that url.
        $.post( window.location.pathname, { language: langValue, data: pasteData, encryptPaste: encryptPaste, lifetime: lifetimeValue })
            .done(function( data ) {
                
                console.log(data)
                if (data.decryptKey != "") {
                    window.location = "/" + data.hash + "/" + data.decryptKey;
                } else {
                    window.location = "/" + data.hash;
                }
        });
        
        //console.log(encryptPaste)
        
        event.preventDefault();
    });
    
    // Reset the password and paste field when the back button is used.
    $(window).bind("pageshow", function() {
        $("#pastePassword").val("");
        $("#pasteContent").val("");
    });

  // This initiates inline re-styling and formatting of code. For now, only JSON data is supported.
  $(document).keydown(function(e) {
   
    if (e.altKey && e.keyCode == 70) {
      var langValue = $("#langList").val();
      if (langValue != 'json') {
        console.log("Only JSON is supported as inline formatting and styling experiment.")
        return;
      }

      var codeElement = document.createElement('code')
      codeElement.className = 'language-'+langValue
      codeElement.textContent = JSON.stringify(JSON.parse($("#pasteContent").val()), null, 2)
      

      var preElement = document.createElement('pre')
      preElement.appendChild(codeElement)
      preElement.className = 'line-numbers'
      
      // Append the newly created element.
      document.getElementById('pasteContent').replaceWith(preElement)
      Prism.highlightElement(codeElement)
      
      e.preventDefault();
      console.log("Hidden feature found! In place formatting!")
    }
  });
});
