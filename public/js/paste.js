function toggleAction(e) { 
   var target = $(e.target);
   $('#action').val(target.attr('id'));
}

$(document).ready(function(){
    
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
});