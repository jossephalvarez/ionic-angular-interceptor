import {AlertController, App} from 'ionic-angular';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import {Injectable, Injector} from '@angular/core';
import {Storage} from '@ionic/storage';
import {Observable} from 'rxjs/Observable';
import {JwtHelperService} from "@auth0/angular-jwt";
import {UserProfileProvider} from "../user-profile/user-profile";
import {CheckTokenStatusProvider} from "../check-token-status/check-token-status";

@Injectable()
export class InterceptorProvider implements HttpInterceptor {
  currentRequest: HttpRequest<any>;

  constructor(private storage: Storage, private alertCtrl: AlertController, public jwtHelper: JwtHelperService, public _up: UserProfileProvider, private _ctp: CheckTokenStatusProvider, public app: App, private injector: Injector) {
    console.log("CONSTRUCTOR DE INTERCEPTOR");
  }

  //VERSION 3
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // as we want to intercept the possible errors, instead of directly returning the request execution, we return an Observable to control EVERYTHING
    let clone: HttpRequest<any>;

    let token = localStorage.getItem('TOKEN');
    if (token) {
      clone = req.clone({
        setHeaders: {
          Accept: `application/json`,
          'Content-Type': `application/json`,
          Authorization: `Bearer ${token}`
        }
      });
    } else {
      clone = req.clone({
        setHeaders: {
          Accept: `application/json`,
          'Content-Type': `application/json`
        }
      });
    }

    return new Observable<HttpEvent<any>>(subscriber => {
      // first try for the request
      next.handle(clone)
        .subscribe((event: HttpEvent<any>) => {
            if (event instanceof HttpResponse) {
              // the request went well and we have valid response
              // give response to user and complete the subscription
              subscriber.next(event);
              subscriber.complete();
            }
          },
          error => {
            if (req.url.search('/auth')) {
              if(error.status === 401){
                let newRequest = req.clone({
                  setHeaders: {
                    Accept: `application/json`,
                    'Content-Type': `application/json`
                  }
                });
                next.handle(newRequest)
                  .subscribe(newEvent => {
                    if (newEvent instanceof HttpResponse) {
                      // the second try went well and we have valid response
                      // give response to user and complete the subscription
                      subscriber.next(newEvent);
                      subscriber.complete();
                    }
                  }, error => {
                    // second try went wrong -> throw error to subscriber
                    subscriber.error(error);
                  });
              }
            } else {
              if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 401)) {
                if (localStorage.getItem('typeRegister') == "loginWithEmail") {
                  // try to re-log the user with EMAIL
                  this._up.loginEmailObs(localStorage.getItem("email"), localStorage.getItem("password")).subscribe(authToken => {
                    let newToken = authToken.result['access_token'];
                    localStorage.removeItem("TOKEN");
                    localStorage.setItem('TOKEN', newToken);
                    let newRequest = req.clone({
                      setHeaders: {
                        Accept: `application/json`,
                        'Content-Type': `application/json`,
                        Authorization: `Bearer ${newToken}`
                      }
                    });
                    // retry the request with the new token
                    next.handle(newRequest)
                      .subscribe(newEvent => {
                        if (newEvent instanceof HttpResponse) {
                          // the second try went well and we have valid response
                          // give response to user and complete the subscription
                          subscriber.next(newEvent);
                          subscriber.complete();
                        }
                      }, error => {
                        // second try went wrong -> throw error to subscriber
                        subscriber.error(error);
                      });
                  });
                } else if (localStorage.getItem('typeRegister') == "loginWithPhone") {
                  // try to re-log the user with PHONE
                  this._up.loginPhoneObs(localStorage.getItem("telephone"), localStorage.getItem("password")).subscribe(authToken => {
                    let newToken = authToken.result['access_token'];
                    localStorage.removeItem("TOKEN");
                    localStorage.setItem('TOKEN', newToken);
                    let newRequest = req.clone({
                      setHeaders: {
                        Accept: `application/json`,
                        'Content-Type': `application/json`,
                        Authorization: `Bearer ${newToken}`
                      }
                    });
                    // retry the request with the new token
                    next.handle(newRequest)
                      .subscribe(newEvent => {
                        if (newEvent instanceof HttpResponse) {
                          // the second try went well and we have valid response
                          // give response to user and complete the subscription
                          subscriber.next(newEvent);
                          subscriber.complete();
                        }
                      }, error => {
                        // second try went wrong -> throw error to subscriber
                        subscriber.error(error);
                      });
                  });
                } else if ((localStorage.getItem('typeRegister') == "FirstTimeEmail") || (localStorage.getItem('typeRegister') == "FirstTimePhone")) {
                  console.log("typeRegister FirstTime" + localStorage.getItem('typeRegister'));
                  this._ctp.cleanStorage();
                  let nav = this.app.getActiveNav();
                  nav.setRoot('Login');

                } else {
                  // FACEBOOK
                  this._ctp.cleanStorage();
                  let nav = this.app.getActiveNav();
                  nav.setRoot('Login');
                }
              } else {
                // the error was not related to auth token -> throw error to subscriber
                subscriber.error(error);
              }

            }

          }
        );
    });
  }

}
