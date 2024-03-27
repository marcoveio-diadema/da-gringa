//  tinyMCE

tinymce.init({
    selector: 'textarea.tiny-mce',
    plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount linkchecker',
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
    tinycomments_mode: 'embedded',
    tinycomments_author: 'Author name',
    mergetags_list: [
        { value: 'First.Name', title: 'First Name' },
        { value: 'Email', title: 'Email' },
    ],
    ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
    });

// Truncate text
function truncateText(text, limit) {
    const words = text.split(' ');

    if (words.length > limit) {
        return words.slice(0, limit).join(' ') + '...';
    }

    return text;
}

$('.intro').each(function() {
    var text = $(this).text();
    var truncated = truncateText(text, 20);
    $(this).text(truncated);
});

// Show/hide password
$('.password-toggle').click(function() {
    var icon = $(this);
    var input = icon.siblings('input');

    if (input.attr('type') === 'password') {
        // Password is hidden, show it and change the icon
        input.attr('type', 'text');
        icon.removeClass('fa-eye').addClass('fa-eye-slash');
    } else {
        // Password is shown, hide it and change the icon
        input.attr('type', 'password');
        icon.removeClass('fa-eye-slash').addClass('fa-eye');
    }
});

// Show/hide mobile menu
$('#searchButton').click(function() {
    $('#searchNav').slideToggle();
  });

// character count
$('#userBioInput').on('input', function() {
    var length = $(this).val().length;
    var color = length >= 150 ? 'red' : '#7E7E7E';
    $('#counter').text(length + '/150').css('color', color);
}).on('keypress', function(e) {
    if ($(this).val().length >= 150) {
        e.preventDefault();
    }
});

// contact form character count
$('#messageInput').on('input', function() {
    var length = $(this).val().length;
    var color = length >= 1000 ? 'red' : '#7E7E7E';
    $('#contactCounter').text(length + '/1000').css('color', color);
}).on('keypress', function(e) {
    if ($(this).val().length >= 150) {
        e.preventDefault();
    }
});
