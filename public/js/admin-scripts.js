// hide and show containers on admin dashboard
$('.container-posts').siblings().hide();

// When a link in the side menu is clicked
$('.list-group-item-action').click(function(e) {
    e.preventDefault();

    // Hide all containers
    $('.container-posts, .container-categories,.container-newsletter, .container-comments, .container-replies, .container-users').hide();

    // Show the container that corresponds to the clicked link
    var linkId = $(this).parent().attr('id');
    $('.container-' + linkId).show();
});
