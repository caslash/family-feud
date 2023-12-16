//
//  MatchManager.swift
//  FeudKit
//
//  Created by Cameron Slash on 12/16/23.
//

import Foundation
import GameKit
import SwiftUI

public class MatchManager: NSObject, ObservableObject {
    public static var shared = MatchManager()
    
    @Published public var inGame = false
    @Published public var isGameOver = false
    @Published public var authenticationState = PlayerAuthState.authenticating
    
    @Published public var game: FamilyFeudGame?
    
    @Published public var player1: GKPlayer?
    @Published public var player2: GKPlayer?
    @Published public var player1Image = Image(systemName: "person.circle.fill")
    @Published public var player2Image = Image(systemName: "person.circle")
    public var match: GKMatch?
    public var localPlayer = GKLocalPlayer.local
    
    #if os(iOS)
    var rootViewController: UIViewController? {
        let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        return windowScene?.windows.first?.rootViewController
    }
    #else
    var rootViewController: NSViewController? {
        return NSApplication.shared.mainWindow?.contentViewController
    }
    #endif
    
    public func authenticateUser() {
        GKLocalPlayer.local.authenticateHandler = { [self] viewController, error in
            if let viewController {
                #if os(iOS)
                self.rootViewController?.present(viewController, animated: true)
                #else
                self.rootViewController?.presentAsModalWindow(viewController)
                #endif
            }
            
            if let error {
                self.authenticationState = .error
                print(error.localizedDescription)
                
                return
            }
            
            if localPlayer.isAuthenticated {
                if localPlayer.isMultiplayerGamingRestricted {
                    self.authenticationState = .restricted
                } else {
                    self.authenticationState = .authenticated
                }
            } else {
                self.authenticationState = .unauthenticated
            }
        }
    }
    
    public func startMatchmaking() {
        let request = GKMatchRequest()
        request.minPlayers = 3
        request.maxPlayers = 3
        
        let matchmakingVC = GKMatchmakerViewController(matchRequest: request)
        matchmakingVC?.matchmakerDelegate = self
        
        #if os(iOS)
        self.rootViewController?.present(matchmakingVC!, animated: true)
        #else
        self.rootViewController?.presentAsModalWindow(matchmakingVC!)
        #endif
    }
    
    public func startGame(newMatch: GKMatch) {
        self.match = newMatch
        self.match?.delegate = self
        self.player1 = self.match?.players[0]
        self.player2 = self.match?.players[1]
        
        self.player1?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
            if let image {
                #if os(iOS)
                self.player1Image = Image(uiImage: image)
                #else
                self.player1Image = Image(nsImage: image)
                #endif
            }
            if let error {
                print("Error \(error.localizedDescription)")
            }
        }
        self.player2?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
            if let image {
                #if os(iOS)
                self.player2Image = Image(uiImage: image)
                #else
                self.player2Image = Image(nsImage: image)
                #endif
            }
            if let error {
                print("Error \(error.localizedDescription)")
            }
        }
        
        self.inGame = true
        
        self.game = FamilyFeudGame()
        _ = self.game?.changeState(type: FFStateType.NEW_GAME)
        NotificationCenter.default.post(name: .DDGameStarted, object: nil)
    }
    
    public func gameOver() {
        self.isGameOver = true
        self.match?.disconnect()
    }
    
    public func resetGame() {
        DispatchQueue.main.async { [self] in
            self.isGameOver = false
            self.inGame = false
            self.game = nil
        }
        
        self.match?.delegate = nil
        self.match = nil
        self.player1 = nil
        self.player2 = nil
    }
}

public enum PlayerAuthState: String {
    case authenticating = "Logging in to Game Center..."
    case unauthenticated = "Please sign in to Game Center to play."
    case authenticated = "Authenticated"
    
    case error = "There was an error logging into Game Center."
    case restricted = "You're not allowed to play multiplayer games!"
}
