// navbar scroll
window.addEventListener('DOMContentLoaded', () => {
    let scrollPos = 0;
    const mainNav = document.getElementById('mainNav');
    const headerHeight = mainNav.clientHeight;

    window.addEventListener('scroll', function() {
        const currentTop = document.body.getBoundingClientRect().top * -1;
        
        if ( currentTop < scrollPos) {
            // Scrolling Up
            if (currentTop > 0 && mainNav.classList.contains('is-fixed')) {
                mainNav.classList.add('is-visible');
            } else {
                console.log(123);
                mainNav.classList.remove('is-visible', 'is-fixed');
            }
        } else {
            // Scrolling Down
            mainNav.classList.remove(['is-visible']);
            if (currentTop > headerHeight && !mainNav.classList.contains('is-fixed')) {
                mainNav.classList.add('is-fixed');
            }
        }
        scrollPos = currentTop;
    });
})

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

// Subscribe form
$('#subscribeForm').on('submit', function(e) {
    e.preventDefault();

    $.ajax({
        type: 'POST',
        url: $(this).attr('action'),
        data: $(this).serialize(),
        success: function(response) {
            // Show success message
            $('#success-message').text(response.success);
            $('#success-alert').show();
            // Clear the form
            $('#subscribeForm')[0].reset();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            // Clear the form
            $('#subscribeForm')[0].reset();
            // Show error message
            $('#error-message').text(jqXHR.responseJSON.error);
            $('#error-alert').show();
        }
    });
});

// time since
$('.comment-time').each(function() {
    var commentTime = $(this).text();
    $(this).text(moment(commentTime, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ').fromNow());
});

// time since for posts
$('.post-time').each(function() {
    var postTime = $(this).text();
    $(this).text(moment(postTime, 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ').fromNow());
});

// ajax for new comments
$('#commentForm').on('submit', function(e){
    e.preventDefault();

    $.ajax({
        url: '/blog/comment',
        method: 'POST',
        data: $(this).serialize(),
        success: function(response){
            // reload the page
            location.reload();
            
            // erase the form
            $('#commentForm')[0].reset();
            console.log(response);
        },
        error: function(xhr, status, error){
            // Handle error here
            console.log(error);
        }
    });
});

// ajax for deleting comments
$('.delete-comment').on('click', function(e) {
    e.preventDefault();

    $.ajax({
        url: `/blog/comment/${$(this).data('comment-id')}`,
        method: 'DELETE',
        success: function(response) {
            if (response.success) {
                // Reload the comments
                location.reload();
            } else {
                // Handle error here
                console.log(response.message);
            }
        },
        error: function(xhr, status, error) {
            // Handle error here
            console.log(error);
        }
    });
});

// ajax for new replies
$('#replyForm').on('submit', function(e){
    e.preventDefault();

    $.ajax({
        url: '/blog/reply',
        method: 'POST',
        data: $(this).serialize(),
        success: function(response){
            // reload the page
            location.reload();
            
            // erase the form
            $('#replyForm')[0].reset();
            console.log(response);
        },
        error: function(xhr, status, error){
            // Handle error here
            console.log(error);
        }
    });
});

// ajax for deleting replies
$('.delete-reply').on('click', function(e) {
    e.preventDefault();

    $.ajax({
        url: `/blog/reply/${$(this).data('reply-id')}`,
        method: 'DELETE',
        success: function(response) {
            if (response.success) {
                // Reload the comments
                location.reload();
            } else {
                // Handle error here
                console.log(response.message);
            }
        },
        error: function(xhr, status, error) {
            // Handle error here
            console.log(error);
        }
    });
});

// ajax for liking comments
$(".like-comment-form").on('submit', function(e){
    e.preventDefault();
    // get the button
    var button = $(this).find('.like-icon');

    $.ajax({
      url: '/blog/like-comment',
      type: 'POST',
      data: $(this).serialize(),
      success: function(response) {
        // reload page
        location.reload();

        // Handle success here
        console.log(response);
      },
      error: function(error) {
        // Handle error here
        console.log(error);
      }
    });
});



// disliking/undo disliking comments
$('.dislike-icon').click(function() {
    var checkbox = $('#dislikeCheck');
    checkbox.prop('checked', !checkbox.prop('checked'));

    if(checkbox.prop('checked')) {
        // If the checkbox is checked, change the icon to the solid heart.
        $(this).removeClass('fa-regular fa-thumbs-down').addClass('fa-solid fa-thumbs-down');
    } else {
        // If the checkbox is not checked, change the icon to the regular heart.
        $(this).removeClass('fa-solid fa-thumbs-down').addClass('fa-regular fa-thumbs-down');
    }
});