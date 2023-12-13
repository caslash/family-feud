//
//  MultiplayerService.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/10/23.
//

import Foundation
import GameKit
import SwiftUI

@MainActor
@Observable
class MultiplayerService: NSObject, GKGameCenterControllerDelegate {
    var friends: [Friend] = []
    
    var matchAvailable = false
    var playingGame = false
    var match: GKMatch? = nil
    var automatch = false
    
    var player1Avatar = Image(systemName: "person.crop.circle")
    var player2Avatar = Image(systemName: "person.crop.circle")
    var player1: GKPlayer? = nil
    var player2: GKPlayer? = nil
    
    #if os(iOS)
    var rootViewController: UIViewController? {
        let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        return windowScene?.windows.first?.rootViewController
    }
    #else
    var rootViewController: NSViewController? {
        return NSApplication.shared.mainWindow!.contentViewController
    }
    #endif
    
    nonisolated override init() { }
    
    func authenticatePlayer() {
        GKLocalPlayer.local.authenticateHandler = { viewController, error in
            if let viewController {
                #if os(iOS)
                self.rootViewController?.present(viewController, animated: true)
                #else
                self.rootViewController?.presentAsSheet(viewController)
                #endif
                return
            }
            if let error {
                print("Error: \(error.localizedDescription)")
                return
            }
            
            GKLocalPlayer.local.register(self)
        
            GKAccessPoint.shared.location = .topLeading
            GKAccessPoint.shared.showHighlights = true
            GKAccessPoint.shared.isActive = true
            
            self.matchAvailable = true
        }
    }
    
    func findPlayer() async {
        let request = GKMatchRequest()
        request.minPlayers = 3
        request.maxPlayers = 3
        let match: GKMatch
        
        do {
            match = try await GKMatchmaker.shared().findMatch(for: request)
        } catch {
            print("Error: \(error.localizedDescription)")
            return
        }
        
        if !self.playingGame {
            self.startMatchWith(match: match)
        }
        
        GKMatchmaker.shared().finishMatchmaking(for: match)
        self.automatch = false
    }
    
    func choosePlayer() {
        let request = GKMatchRequest()
        request.minPlayers = 3
        request.maxPlayers = 3
        
        if let viewController = GKMatchmakerViewController(matchRequest: request) {
            viewController.matchmakerDelegate = self
            #if os(iOS)
            rootViewController?.present(viewController, animated: true) { }
            #else
            rootViewController?.presentAsModalWindow(viewController)
            #endif
        }
    }
    
    func startMatchWith(match: GKMatch) {
        GKAccessPoint.shared.isActive = false
        self.playingGame = true
        self.match = match
        self.match?.delegate = self
        
        if self.match?.expectedPlayerCount == 0 {
            self.player1 = self.match?.players[0]
            self.player2 = self.match?.players[1]
            
            self.player1?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
                if let image {
                    #if os(iOS)
                    self.player1Avatar = Image(uiImage: image)
                    #else
                    self.player1Avatar = Image(nsImage: image)
                    #endif
                }
                if let error {
                    print("Error: \(error.localizedDescription)")
                }
            }
            
            self.player2?.loadPhoto(for: GKPlayer.PhotoSize.small) { (image, error) in
                if let image {
                    #if os(iOS)
                    self.player2Avatar = Image(uiImage: image)
                    #else
                    self.player2Avatar = Image(nsImage: image)
                    #endif
                }
                if let error {
                    print("Error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func endMatch() {
        
    }
    
    func resetMatch() {
        // Reset the game data.
        playingGame = false
        self.match?.disconnect()
        self.match?.delegate = nil
        self.match = nil
        self.player1 = nil
        self.player2 = nil
        self.player1Avatar = Image(systemName: "person.crop.circle")
        self.player2Avatar = Image(systemName: "person.crop.circle")
        GKAccessPoint.shared.isActive = true
    }
    
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        #if os(iOS)
        gameCenterViewController.dismiss(animated: true)
        #else
        rootViewController?.dismiss(gameCenterViewController)
        #endif
    }
}
