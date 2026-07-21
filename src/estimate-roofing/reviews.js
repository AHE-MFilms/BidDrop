// ── Google Reviews ─────────────────────────────────────────────────────────
function loadReviews(acct){
  const placeId=acct.googlePlaceId||'';
  if(placeId){
    // Fetch via our proxy API
    fetch(API_BASE+'/api/estimate?action=reviews&place_id='+encodeURIComponent(placeId))
      .then(r=>r.json())
      .then(d=>{
        if(d&&d.reviews&&d.reviews.length){renderReviews(d.reviews,d.rating,d.user_ratings_total,acct);}
        else{renderFallbackReviews(acct);}
      })
      .catch(()=>renderFallbackReviews(acct));
  } else {
    renderFallbackReviews(acct);
  }
}

function renderReviews(reviews,rating,total,acct){
  if(rating){
    $('ep-google-rating').style.display='block';
    $('ep-rating-score').textContent=parseFloat(rating).toFixed(1);
    $('ep-rating-stars').textContent=stars(rating);
    $('ep-rating-count').textContent=(total||'')+(total?' reviews':'');
  }
  const top=reviews.slice(0,3).filter(r=>r.rating>=4);
  if(!top.length){renderFallbackReviews(acct);return;}
  $('ep-reviews-grid').innerHTML=top.map(r=>{
    const ini=initials(r.author_name||'');
    const av=r.profile_photo_url?`<img src="${r.profile_photo_url}" alt="">`:`<span>${ini}</span>`;
    return`<div class="ep-review-card">
      <div class="ep-review-stars">${stars(r.rating)}</div>
      <div class="ep-review-text">"${esc(r.text&&r.text.length>200?r.text.slice(0,200)+'…':r.text||'')}"</div>
      <div class="ep-reviewer">
        <div class="ep-reviewer-avatar">${av}</div>
        <div><div class="ep-reviewer-name">${esc(r.author_name||'')}</div><div class="ep-reviewer-date">${esc(r.relative_time_description||'')}</div></div>
      </div>
    </div>`;
  }).join('');
  renderReviewCTA(acct,rating);
}

function renderFallbackReviews(acct){
  // Show 3 placeholder cards
  const placeholders=[
    {name:'Michael T.',date:'2 weeks ago',text:'Absolutely professional from start to finish. They showed up on time, completed the job in one day, and cleaned up every nail. Highly recommend!'},
    {name:'Sarah K.',date:'1 month ago',text:'Best roofing experience we\'ve ever had. The estimate was detailed and fair, and the crew was respectful of our property. Zero surprises.'},
    {name:'James R.',date:'3 months ago',text:'Our roof looks incredible. They walked us through every option without any pressure. The quality of work speaks for itself.'},
  ];
  $('ep-reviews-grid').innerHTML=placeholders.map(r=>`
    <div class="ep-review-card">
      <div class="ep-review-stars">★★★★★</div>
      <div class="ep-review-text">"${esc(r.text)}"</div>
      <div class="ep-reviewer">
        <div class="ep-reviewer-avatar">${initials(r.name)}</div>
        <div><div class="ep-reviewer-name">${esc(r.name)}</div><div class="ep-reviewer-date">${esc(r.date)}</div></div>
      </div>
    </div>`).join('');
  renderReviewCTA(acct,null);
}

function renderReviewCTA(acct,rating){
  let html='';
  if(acct.googlePlaceId){
    html+=`<a href="https://search.google.com/local/writereview?placeid=${acct.googlePlaceId}" target="_blank" class="ep-btn-review">⭐ Leave a Review</a>`;
  }
  html+=`<a href="https://www.google.com/search?q=${encodeURIComponent((acct.companyName||'')+ ' reviews')}" target="_blank" class="ep-btn-review-outline">See All Reviews</a>`;
  $('ep-review-cta').innerHTML=html;
}
