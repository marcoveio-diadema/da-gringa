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

//  tinyMCE for blog posts
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

//  tinyMCE for forum discussions
tinymce.init({
    selector: 'textarea.tiny-mce-basic', // use a different class for the other textarea
    plugins: 'link lists wordcount',
    toolbar: 'undo redo | bold italic underline | align | numlist bullist',
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
    if ($(this).val().length >= 1000) {
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

// ajax for disliking comments
$(".dislike-comment-form").on('submit', function(e){
    e.preventDefault();

    $.ajax({
      url: '/blog/dislike-comment',
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

// ajax for liking replies
$(".like-reply-form").on('submit', function(e){
    e.preventDefault();

    $.ajax({
      url: '/blog/like-reply',
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

// ajax for disliking replies
$(".dislike-reply-form").on('submit', function(e){
    e.preventDefault();

    $.ajax({
      url: '/blog/dislike-reply',
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

// NEW FORUM DISCUSSION FORM
const slidePage = $('.slidepage');
const firstNextBtn = $('.nextBtn');
const prevBtnSec = $('.prev-1');
const nextBtnSec = $('.next-1');
const prevBtnThird = $('.prev-2');
const nextBtnThird = $('.next-2');
const prevBtnFourth = $('.prev-3');
const submitBtn = $('.submit');
const progressText = $('.step p');
const progressCheck = $('.step .check');
const bullet = $('.step .bullet');

let max = 4;
let current = 1;

// move forward
firstNextBtn.click(function(){
    slidePage.css('margin-left', '-25%');
    bullet.eq(current - 1).addClass('active');
    progressText.eq(current - 1).addClass('active');
    progressCheck.eq(current - 1).addClass('active');
    current += 1;
});

nextBtnSec.click(function(){
    slidePage.css('margin-left', '-50%');
    bullet.eq(current - 1).addClass('active');
    progressText.eq(current - 1).addClass('active');
    progressCheck.eq(current - 1).addClass('active');
    current += 1;
});

nextBtnThird.click(function(){
    slidePage.css('margin-left', '-75%');
    bullet.eq(current - 1).addClass('active');
    progressText.eq(current - 1).addClass('active');
    progressCheck.eq(current - 1).addClass('active');
    current += 1;
});

submitBtn.click(function(){
    bullet.eq(current - 1).addClass('active');
    progressText.eq(current - 1).addClass('active');
    progressCheck.eq(current - 1).addClass('active');
    current += 1;
});

// move backward
prevBtnSec.click(function(){
    slidePage.css('margin-left', '-0%');
    bullet.eq(current - 2).removeClass('active');
    progressText.eq(current - 2).removeClass('active');
    progressCheck.eq(current - 2).removeClass('active');
    current -= 1;
});

prevBtnThird.click(function(){
    slidePage.css('margin-left', '-25%');
    bullet.eq(current - 2).removeClass('active');
    progressText.eq(current - 2).removeClass('active');
    progressCheck.eq(current - 2).removeClass('active');
    current -= 1;
});

prevBtnFourth.click(function(){
    slidePage.css('margin-left', '-50%');
    bullet.eq(current - 2).removeClass('active');
    progressText.eq(current - 2).removeClass('active');
    progressCheck.eq(current - 2).removeClass('active');
    current -= 1;
});

// new discussion form character count
$('#contentInput').on('keypress', function(e) {
    if ($(this).val().length >= 1000) {
        e.preventDefault();
    }
});

// countries list
const countries = [
    "Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda", "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão",
    "Bahamas", "Bangladesh", "Barbados", "Bélgica", "Belize", "Benin", "Bielorrússia", "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burkina Faso", "Burundi",
    "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão", "Chade", "Chile", "China", "Chipre", "Colômbia", "Comores", "Congo-Brazzaville", "Coreia do Norte", "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba",
    "Dinamarca", "Djibuti", "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia", "Eslovênia", "Espanha", "Estados Unidos", "Estônia", "Etiópia",
    "Fiji", "Filipinas", "Finlândia", "França",
    "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala", "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Holanda", "Honduras", "Hungria",
    "Iêmen", "Ilhas Marshall", "Índia", "Indonésia", "Inglaterra", "Irã", "Iraque", "Irlanda", "Islândia", "Israel", "Itália",
    "Jamaica", "Japão", "Jordânia",
    "Kiribati", "Kuwait", "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia", "Luxemburgo",
    "Macedônia", "Madagascar", "Malásia", "Malawi", "Maldivas", "Mali", "Malta", "Marrocos", "Maurício", "Mauritânia", "México", "Mianmar", "Micronésia", "Moçambique", "Moldávia", "Mônaco", "Mongólia", "Montenegro",
    "Namíbia", "Nauru", "Nepal", "Nicarágua", "Níger", "Nigéria", "Noruega", "Nova Zelândia",
    "Omã",
    "Palau", "Panamá", "Papua-Nova Guiné", "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal",
    "Quênia", "Quirguistão",
    "Reino Unido", "República Centro-Africana", "República Checa", "República Democrática do Congo", "República Dominicana", "Romênia", "Ruanda", "Rússia",
    "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Nevis", "São Tomé e Príncipe", "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Singapura", "Síria", "Somália", "Sri Lanka", "Suazilândia", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname",
    "Tailândia", "Taiwan", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago", "Tunísia", "Turcomenistão", "Turquia", "Tuvalu",
    "Ucrânia", "Uganda", "Uruguai", "Uzbequistão",
    "Vanuatu", "Vaticano", "Venezuela", "Vietnã",
    "Zâmbia", "Zimbábue"
];

// countries auto complete
$('#country').autocomplete({
    source: countries
});

// forum discussion form tags
const ul = $('.discussion-tags');
const input = $('.tags-input');
const countNumbers = $('.details span');

let maxTags = 5;

countTag();

function countTag(){
    countNumbers.text(maxTags - tags.length);
}

function createTag (){
    // remove all li tags before so there's no duplicated
    ul.find('li').remove();
    // also remove all hidden inputs for tags
    $('.discussion-tags input[name="tags"]').remove();
    tags.slice().reverse().forEach(tag => {
        let liTag = `<li class="list-group-item bg-light d-flex align-items-center m-2 p-2 rounded border">${tag} <i class="fa-solid fa-xmark mx-2"  onclick="remove(this, '${tag}')"></i> </li>`;
        ul.prepend(liTag);

        // Create a new hidden input for the tag
        let tagInput = document.createElement("input");
        tagInput.type = "hidden";
        tagInput.name = "tags";
        tagInput.value = tag;
        // Append the hidden input to the form
        $('.discussion-tags').append(tagInput);
    });
    // update the count
    countTag();
}

function remove(element, tag){
    let index = tags.indexOf(tag); // get the index of the tag
    tags = [...tags.slice(0, index), ...tags.slice(index + 1)]; // remove the tag from the array
    element.parentElement.remove(); // remove the tag from the list
    // Remove the corresponding hidden input
    $(`.discussion-tags input[value="${tag}"]`).remove();
    // update the count
    countTag();
}

// Uppercase first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

// add tag to tags list
function addTag(tag){
    tag = tag.trim().replace(/\s+/g, ' ');
    if(tag.length > 1 && !tags.includes(tag)){
        if(tags.length < maxTags){
            tag.split(',').forEach(tag => {
                tag = capitalizeFirstLetter(tag.trim());
                tags.push(tag);
                createTag();                                
            });
        }
    }
}

input.on('keydown', function(e) {
    if(e.key == 'Enter'){
        e.preventDefault();
        addTag(e.target.value);
        e.target.value = '';
    }
});

// remove all tags
const removeAll = $('.remove-all');
removeAll.on('click', () => {
    tags = [];
    ul.find('li').remove();

    // Remove all hidden inputs for tags
    $('.discussion-tags input[name="tags"]').remove();
    
    countTag();
});

// auto complete for tags input
$('.tags-input').autocomplete({
    source: function(request, response) {
        $.ajax({
            url: '/forum/get-tags', // replace with the URL to your server endpoint that returns the tags
            data: {
                term: request.term
            },
            success: function(data) {
                response(data);
            }
        });
    },
    minLength: 2, // start showing suggestions after 2 characters
    select: function(event, ui) {
        // Add the selected item to the UL
        addTag(ui.item.value); 
        // Clear the input field
        $(this).val('');
        
        // Prevent the default action of setting the input field to the selected value
        return false;
    }
});