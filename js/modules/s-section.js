//story panel
(function(){

    var _options = {},
    story;

    /******************** data *********************/

    var Data = Backbone.Model.extend({
        url: 'php/story.php',
        defaults: {
            pid: pid,
        },
        record: function(action){
            this.set('action', action);
            var date = new Date();
            this.set('updatetime', {
                name: 'updatetime',
                value: date.toUTCString()
            });
            this.save();
            console.log(this);
        }
    });

    /************** story title block****************/

    var TitleModel = Backbone.Model.extend({
        defaults: {
            "title": "",
            "subtitle": ""
        }
    });
    //render story title block
    var TitleView = Backbone.View.extend({
        tagName: 'div',
        initialize:function(){
            var view = this;
            $(window).resize(function(){
                view.resize();
            });
        },
        resize: function(){
            $("#t").height($(window).height()).css("margin-bottom",$('#t').height()/3);
            $('#story-title').css("padding-top", ($(window).height()/2) - $('#story-title').height() - $('#story-subtitle').height());
        },
        render: function(){            
            //set title
            if (this.model.get('title').length > 0){
                this.$el.append('<h1 id="story-title">'+ this.model.get('title') +'</h1>');
            } else{
                //title default
                this.$el.append('<h1 id="story-title">Story Title</h1>');
            };
            //set subtitle
            if (this.model.get('subtitle').length > 0){
                this.$el.append('<h3 id="story-subtitle">'+ this.model.get('subtitle') +'</h3>');
            };
            //set title/subtitle text color (default is black)
            if (this.model.get('color').length > 0){
                this.$el.css("color",this.model.get('color'));
            }
            //add flashing arrow to bottom of title block
            this.$el.append('<h1 id="story-arrow">&darr;</h1>');
            //add block to empty title div
            $('#t').append(this.$el);
            //position title/subtitle in relation to window height
            var padding = ($(window).height()/2) - $('#story-title').height() - $('#story-subtitle').height();
            $('#story-title').css("padding-top", padding);
        }
    });

    /************** story element blocks ****************/

    var BlockModel = Backbone.Model.extend({
        defaults: {
            "label": "",
            "title": "",
            "subtitle": "",
            "ask": "",
            "description": "",
            "image": "",
            "image2": "",
            "video": "",
            "input": {}
        }
    });
    var BlockView = Backbone.View.extend({
        tagName: 'div',
        initialize:function(){
            var view = this;
            $(window).resize(function(){
                view.resize(view);
            });
        },
        setLabel: function(){
            return "p"+(_page+1)+"s"+(_set+1)+"b"+(_block+1);
        },
        resize:function(){
            var h = $(window).height();
            $('.sticky-padding').css("height",h);
            $('#sticky' + (_block + 1)).css("height",h);
        },
        render: function(){
            //create label if none
            if (this.model.get('label').length == 0){
                this.model.set('label', this.setLabel());
            } else {
                this.model.set('label', this.model.get('label').substring(0, 20));
            };
            var h = 'auto';
            if (this.model.get('stickyImage')){
                this.$el.append('<p class="sticky" id="sticky'+ (_block+1) +'"><img class="map-image sticky-image" src="'+ this.model.get('stickyImage') +'"></p>');
                h = $(window).height();
            };
            //assign label to div classname
            this.$el.attr('class', 'block '+this.model.get('label'));
            if (this.model.get('topline')){
                this.$el.append('<hr>');
            };
            //set title
            if (this.model.get('title').length > 0){
                this.$el.append('<h1 class="map-title s-block'+ (_block+1) +'">'+ this.model.get('title') +'</h1>');
            };
            //set subtitle
            if (this.model.get('subtitle').length > 0){
                this.$el.append('<h3 class="map-subtitle s-block'+ (_block+1) +'">'+ this.model.get('subtitle') +'</h3>');
            };

            if (this.model.get('quote')){
                this.$el.append('<h3 class="quote s-block'+ (_block+1) +'">'+ this.model.get('quote') +'</h3>');
            };
            //set image
            if (this.model.get('image').length > 0){
                this.$el.append('<p><img class="map-image s-block'+ (_block+1) +'" src="'+ this.model.get('image') +'"></p>');
            };
            //set video
            if (this.model.get('video').length > 0){
                var video = this.model.get('video'),
                    template = video.indexOf('http') > -1 ? _.template( $('#iframe-template').html() ) : _.template( $('#video-template').html() ),
                    width = $("#q").width(),
                    height = width * 9 / 16;
                this.$el.append(template({
                    width: width,
                    height: height,
                    source: video
                }));
            };
            //set description
            if (this.model.get('description').length > 0){
                this.$el.append('<p class="map-description s-block'+ (_block+1) +'">'+ this.model.get('description') +'</p>');
            };
            if (this.model.get('bottomline')){
                this.$el.append('<hr>');
            };
            if (this.model.get('stickyImage')){
                this.$el.append('<div class="sticky-padding" style="height:' + h + 'px"></div>');
            };
            //create spacing between all blocks except the first
            if (_block != 0){
                this.$el.css("margin-top","25em")
            }
            //add block to story
            $('#s form').append(this.$el);
            //resize videos if added
            var w = $('#s form').width();
            $('video, iframe').attr({
                width: w,
                height: w * 9 / 16
            });

            if (this.model.get('background')){
                $('.s-block' + (_block + 1)).css("background",this.model.get('background'));
            };

            $('.s-block' + (_block + 1)).css("margin-bottom",h);
            $('#sticky' + (_block + 1)).css("height",h);
        }
    });
    /***************** story *******************/
    var Story = Backbone.View.extend({
        el: '#s',
        resize: function(view){
            if (!this.model.get('story').reverse){
                $("#s").css('max-height', $("form").height());
            }
            if (this.model.get('story').float){
                var left =  ($('#content-container').width() / 2) + $('.button').width();
                bottom = $('#footer').height() - 5;
                $('.buttons').css("bottom",bottom).css("left",left);
            }
            if ($('.sticky-image')){
                var sh = $('.sticky-image').height()
                $('.sticky-image').css("margin-top",($('#content-container').height() - sh)/2);
            }
        },
        initialize: function(){
            var view = this;
            view.time,
            view.currentBlock;

            $(window).resize(function(){
                view.resize(view);
            });
            $("#content-container").scroll(function(){
                //activate block scroll listeners
                if ($("#story-form").length){
                    view.scrollTracker();
                }
                //activate floating buttons if set
                if (view.model.attributes.story.float){
                    view.floatButton(view);
                }
            });

        },
        clickTracker:function(){
            //activate click listeners for each block
            var items = _options.get('data');
                _.each(items, this.checkClick);
        },
        checkClick:function(item){
            if (item.label){
                $(item.label).click(function(event){
                    item.clicks++;
                });
            }
        },
        scrollTracker:function(){
            //activate scroll listeners for each block
            var items = _options.get('data');
                _.each(items, this.checkScroll, this);
        },
        checkScroll: function (item){
            var date = new Date(),
                currentTime = date.getTime();
            //check if blocks are in view, update time attribute if they are
            if (item.label){
                if (this.isScrolledIntoView(item.label)){
                    this.currentBlock = item;
                    if (this.time){
                        item.time = item.time  + (currentTime - this.time); 
                    }
                    this.time = currentTime;
                }
            }
        },
        isScrolledIntoView:function(elem){
            //function for determining if a block is in view
            if ($(elem)[0]){
                var docViewTop = $(window).scrollTop();
                var docViewBottom = docViewTop + $(window).height();

                var elemTop = $(elem).offset().top;
                var elemBottom = elemTop + $(elem).height();
                var elemCenter = elemTop + ($(elem).height()/2);

                return (((elemBottom <= docViewBottom) && (elemTop >= docViewTop)) || ((elemCenter <= docViewBottom) && (elemCenter >= docViewTop)));
            }
        },
        //render story title block
        renderTitle: function(title){
            var titleModel = new TitleModel(title);
            var titleView = new TitleView({model: titleModel});
            titleView.render();
        },
        //render story element blocks
        renderBlock: function(block, i){
            _block = i;
            var blockModel = new BlockModel(block);
            var blockView = new BlockView({model: blockModel});
            blockView.render();
        },
        //activate floating buttons if set
        floatButton:function(){
            //set floating button css
            if ($('#content-container').scrollTop() > $('#t').height() || !$("#story-form").length){
                $('.buttons').css("display","block");
            } else {
                $('.buttons').css("display","none");
            }
            $('.buttons').css("position","fixed").css("z-index",1000);
            this.resize();
        },
        render: function(){
            // detach map from container so it can be placed according to reverse status
            var map = $('#m').detach();
            //scroll to top of page
            $('#content-container').scrollTop(0);
            //add an empty form for the blocks to populate
            this.$el.empty().append('<form id="story-form">');
            //resize title block
            $("#t").height($(window).height()).css("margin-bottom",$('#t').height()/3);
            //is the story reversed?
            if (this.model.get('story').reverse){
                //add and position title block and map
                $("#s").before(map);
                $("#s").css("margin-top",$('#m').height()/2);
            }
            else{
                //add and position title block and map
                $("#s").after(map);
                $("#s").css("margin-bottom",$('#m').height()/2);
            }
            //render title elements
            var sTitle = this.model.get('story');
            this.renderTitle(sTitle);            
            //get current set
            var sset = this.model.get('sets')[_set];
            //render blocks
            _.each(sset.blocks, this.renderBlock, this);
            //position map and buttons according to height of populated form
            Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))).then(() => {
                $("#s").css('max-height', $("form").height());
                if ($('.sticky-image')){
                    var sh = $('.sticky-image').height()
                    $('.sticky-image').css("margin-top",($('#content-container').height() - sh)/2);
                }
            });
            //set background image if selected
            if (this.model.get('story').background){
                $('#t').css("background-image","url('" + this.model.attributes.story.background + "')").css("background-repeat","no-repeat").css("background-size","cover").css("background-position","center");
            }
            //create data structure
            this.createDataStructure();

            //set next listener
            document.off('nextset');
            document.on('nextset', this.next, this);
        },
        createDataStructure: function(){
            //create data structure for logging story data
            var blocks = this.$el.find('.block').toArray();
                _.each(blocks, this.addData, this);
            
            this.addData('p' + (_page + 1) + 'map');

            this.clickTracker();
        },
        addData: function(block){            
            var label;
            //determine if block is a story element or map object
            if ($(block).attr("class")){
                block.label = $(block).attr("class");
                label = block.label.replace("block ","");
            }
            else{
                label = block;
            }
            //check if data block already exists 
            if (!_options.attributes.data[label]){
                //add new data block
                _options.attributes.data[label] = {
                        label: '.' + label,
                        name: label,
                        page:_page+1,
                        time: 0,
                        clicks: 0
                    };
            }
            _options.attributes.data["currentpage"] = {
                name: "currentpage",
                page:_page+1
            };
        },
        record: function(){            
            var date = new Date();
            this.currentBlock.time = this.currentBlock.time + (date.getTime() - this.time); 

            var dataModel = new Data(_options.get('data'));
            dataModel.record('set');
            return true;
        }
    });

    /*************** set story *****************/
    
    function setStory(options){
        //reset question set counter
        _set = 0;
        
        if (typeof options != 'undefined'){
            var dataModel = new Data(options.attributes);
            dataModel.record('init');
            //set global _options variable to config model
            _options = options;
            //add data object to hold all recorded data
            _options.set('data', {
                pid: {
                    name: 'pid',
                    value: pid
                }
            });
        };
        var Page = Backbone.DeepModel.extend(),
        page = _options.get('pages') ? new Page(_options.get('pages')[_page]) : null;
        if (page){            
            //check if story mode is active
            if (page.attributes.story){  
                $('#t').empty().show();
                $('#s').show();
                document.getElementById("content-container").classList.add("story-active");

                story = new Story();
                story.model = page;
                story.render();
            }
            else{  
                story = null;
                
                $('#m').css("margin","0");
                $('#s').empty().hide();
                $('#t').empty().hide();

                document.getElementById("content-container").classList.remove("story-active");

                var map = $("#m").detach();
                $("#t").after(map);
            }
        };

        document.trigger('ready');
    };
    
    /************** questions config **************/
    
    function config(){
        var StoryConfig = Backbone.DeepModel.extend({
            url: _config+"/questions.json"
        });
        //get questions configuration options
        var sConfig = new StoryConfig();
        sConfig.on('sync error', setStory);
        sConfig.fetch();
    };

    function resetStory(){
        //record story data if story is present
        if (story) {
            story.record();
        }
        //remove block listeners
        $("#content-container").off();
        $("#m").off();
        if (_options.attributes.hasOwnProperty("pages") && _options.get('pages').length > _page){
            setStory();
        };
    };
    
    //trigger next page
    document.on({
        '>>': resetStory,
        '<<': resetStory
    });
    
    document.on('init', config);
    
    })();
    