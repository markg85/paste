function toggleAction(e) { 
   var target = $(e.target);
   $('#action').val(target.attr('id'));
}

$(document).ready(function(){
    
    $('.auto-save').savy('load');
    $('#plain_paste').on('click', toggleAction);
    $('#encrypted_paste').on('click', toggleAction);
    
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
        $.post( "/", { language: langValue, data: pasteData, encryptPaste: encryptPaste, lifetime: lifetimeValue })
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
